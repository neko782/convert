// file: tarCompressed.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { gzipSync as gzip, gunzipSync as gunzip } from "fflate";
import { decompress as unzstd } from "fzstd";

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
    {
      name: "Zstd compressed Tape Archive",
      format: "tar.zst",
      extension: "zst",
      mime: "application/zstd",
      from: true, 
      to: false,
      internal: "tar.zst",
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
            const gzipped = gzip(inputFile.bytes);
            outputFiles.push({ bytes: gzipped, name: inputFile.name + ".gz" });
          }
          break;
      }
    } else if (outputFormat.internal === "tar") {
      switch (inputFormat.internal) {
        case "tar.gz":
          for (const inputFile of inputFiles) { 
            const tar = gunzip(inputFile.bytes);
            outputFiles.push({ bytes: tar, name: inputFile.name.replace(/\.gz$/i, "") });
          }
          break;
        case "tar.zst":
          for (const inputFile of inputFiles) { 
            const tar = unzstd(inputFile.bytes);
            outputFiles.push({ bytes: tar, name: inputFile.name.replace(/\.zst$/i, "") });
          }
          break;
      }
    } else {
      throw "tarCompressedHandler cannot process this conversion";
    }

    return outputFiles;
  }

}

export default tarCompressedHandler;