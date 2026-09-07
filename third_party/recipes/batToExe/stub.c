#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <process.h>
#include <stdint.h>
#include <stdio.h>
#include <wchar.h>

int wmain(void) {
    // Open this executable and read its footer.
    wchar_t exe[32768];
    DWORD exePathLength = GetModuleFileNameW(NULL, exe, 32768);
    if (exePathLength == 0 || exePathLength >= 32768) return 1;

    FILE *source = _wfopen(exe, L"rb");
    if (source == NULL) return 1;

    if (_fseeki64(source, -4, SEEK_END) != 0) return 1;

    __int64 footerOffset = _ftelli64(source);
    if (footerOffset < 0) return 1;

    uint32_t batchSize;
    if (fread(&batchSize, sizeof(batchSize), 1, source) != 1) return 1;
    if (batchSize > footerOffset) return 1;

    // The batch bytes sit immediately before the footer.
    __int64 batchOffset = footerOffset - batchSize;
    if (_fseeki64(source, batchOffset, SEEK_SET) != 0) return 1;

    // Reserve a temporary file, then give it a .bat extension.
    wchar_t tempDir[MAX_PATH];
    DWORD tempDirLength = GetTempPathW(MAX_PATH, tempDir);
    if (tempDirLength == 0 || tempDirLength >= MAX_PATH - 18) return 1;

    wchar_t tempFile[MAX_PATH];
    if (!GetTempFileNameW(tempDir, L"ctb", 0, tempFile)) return 1;

    wchar_t batchFile[MAX_PATH];
    wcscpy(batchFile, tempFile);
    wcscat(batchFile, L".bat");

    if (!MoveFileW(tempFile, batchFile)) return 1;

    // Copy the batch bytes into the temporary file.
    FILE *output = _wfopen(batchFile, L"wb");
    if (output == NULL) return 1;

    char buffer[65536];
    uint32_t remaining = batchSize;
    while (remaining > 0) {
        size_t count = sizeof(buffer);
        if (remaining < count) count = remaining;

        if (fread(buffer, 1, count, source) != count) return 1;
        if (fwrite(buffer, 1, count, output) != count) return 1;

        remaining -= count;
    }

    if (fclose(output) != 0) return 1;
    fclose(source);

    // Run cmd.exe and wait. Keep the caller's working directory.
    wchar_t command[MAX_PATH];
    DWORD systemDirLength = GetSystemDirectoryW(command, MAX_PATH);
    if (systemDirLength == 0 || systemDirLength >= MAX_PATH - 9) return 1;
    wcscat(command, L"\\cmd.exe");

    // Expanding an environment variable keeps percent signs in the path literal.
    if (_wputenv_s(L"CONVERT_BAT_FILE", batchFile) != 0) return 1;

    intptr_t status = _wspawnl(
        _P_WAIT,
        command,
        L"cmd.exe",
        L"/d",
        L"/s",
        L"/c",
        L"\"\"%CONVERT_BAT_FILE%\"\"",
        NULL
    );

    DeleteFileW(batchFile);
    return status == -1 ? 1 : (int)status;
}
