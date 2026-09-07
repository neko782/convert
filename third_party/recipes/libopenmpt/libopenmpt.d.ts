// Type declarations for the Emscripten module produced by build.sh.
// Only the exports the libopenmpt handler uses are declared.

export interface LibOpenMPTModule {
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  _openmpt_module_create_from_memory2(
    filedata: number,
    filesize: number,
    logfunc: number,
    loguser: number,
    errfunc: number,
    erruser: number,
    error: number,
    error_message: number,
    ctls: number,
  ): number;
  _openmpt_module_destroy(mod: number): void;
  _openmpt_module_set_repeat_count(mod: number, repeat_count: number): number;
  _openmpt_module_read_interleaved_stereo(
    mod: number,
    samplerate: number,
    count: number,
    interleaved_stereo: number,
  ): number;
}

export interface LibOpenMPTModuleOptions {
  locateFile?(path: string, scriptDirectory: string): string;
  wasmBinary?: ArrayBuffer;
}

export default function createLibopenmpt(
  options?: LibOpenMPTModuleOptions,
): Promise<LibOpenMPTModule>;
