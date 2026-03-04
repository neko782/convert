// file: tarCompressed.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { gzipSync, gunzipSync } from "fflate";

class tarCompressedHandler implements FormatHandler {

  public name: string = "tarCompressed";
  public supportedFormats?: FileFormat[] = [
    CommonFormats.TAR.builder("tar").allowFrom().allowTo().markLossless(),
    {
      name: "Gzipped Tape Archive",
      format: "tar.gz",
      extension: "gz",
      mime: "application/gzip",
      from: true,
      to: true,
      internal: "tar.gz",
      category: "archive",
      lossless: true
    },
  ];
  public ready: boolean = false;

  async init () {
    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];
    if (inputFormat.internal === "tar") {
      switch (outputFormat.internal) {
        case "tar.gz":
          for (const inputFile of inputFiles) { 
            const gzipped = gzipSync(inputFile.bytes);
            outputFiles.push({ bytes: gzipped, name: inputFile.name + ".gz" });
          }
          break;
      }
    } else if (outputFormat.internal === "tar") {
      switch (inputFormat.internal) {
        case "tar.gz":
          for (const inputFile of inputFiles) { 
            const tar = gunzipSync(inputFile.bytes);
            outputFiles.push({ bytes: tar, name: inputFile.name + ".gz" });
          }
          break;
      }
    }
    return outputFiles;
  }

}

export default tarCompressedHandler;