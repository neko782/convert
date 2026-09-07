import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import { InitializationError } from "src/errors.ts";

import stubUrl from "third_party/generated/batToExe/stub.exe?url";

const TRAILER_SIZE = 4;

class batToExeHandler implements FormatHandler {
  public name = "batToExe";
  public supportedFormats = [
    CommonFormats.BATCH.supported("bat", true, false),
    CommonFormats.EXE.supported("exe", false, true, true), // Stores the exact input bytes
  ];
  public ready = false;

  private stub: Uint8Array | null = null;

  async init() {
    const response = await fetch(stubUrl);
    if (!response.ok)
      throw new InitializationError(
        `Failed to load batch launcher: ${response.status}`,
      );
    const stub = new Uint8Array(await response.arrayBuffer());
    this.stub = stub;
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    const stub = this.stub;
    if (!this.ready || !stub)
      throw new InitializationError("Handler not initialized.");
    const outputFiles: FileData[] = [];
    for (const file of inputFiles) {
      const out = new Uint8Array(
        stub.length + file.bytes.length + TRAILER_SIZE,
      );
      out.set(stub);
      out.set(file.bytes, stub.length);
      const trailerOffset = stub.length + file.bytes.length;
      new DataView(out.buffer).setUint32(
        trailerOffset,
        file.bytes.length,
        true,
      );
      outputFiles.push({
        name: file.name.replace(/\.[^.]+$/, "") + "." + outputFormat.extension,
        bytes: out,
      });
    }
    return outputFiles;
  }
}

export default batToExeHandler;
