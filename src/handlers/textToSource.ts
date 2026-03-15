// file: textToSource.ts

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";

function python(text: string): string {
  return `print(${JSON.stringify(text)})`;
}

function go(text: string): string {
  text = text.replaceAll(/\r?\n/g, "\n").replaceAll("`", "` + \"`\" + `");
  return `package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\`${text}\`)\n}\n`;
}

function batch(text: string): string {
  text = text
    .replaceAll("^", "^^")
    .replaceAll("%", "%%")
    .replaceAll("&", "^&")
    .replaceAll("|", "^|")
    .replaceAll("<", "^<")
    .replaceAll(">", "^>");
  const lines = text.split(/\r?\n/);
  const echos = lines.map(line => line.trim() === "" ? "echo.\r\n" : `echo ${line}\r\n`);
  return `@echo off\r\n${echos.join("")}pause\r\n`;
}

function shell(text: string): string {
  text = text.replaceAll("'", "'\"'\"'");
  return `#!/bin/sh\nprintf '%s\n' '${text}'`;
}

function csharp(text: string): string {
  // Content of the .txt file will be translated to a C# verbatim string,
  // so quotes must be escaped using the verbatim string escape syntax (two double quotes, "")
  // instead of the usual \" escape.
  text = text.replaceAll(/\r?\n/g, "\n").replaceAll("\"", "\"\"");
  return `using System;\n\nConsole.WriteLine(@"${text}");\n\nConsole.Read();\n`;
}

class textToSourceHandler implements FormatHandler {

  static converters: [FileFormat, (text: string) => string][] = [
    [CommonFormats.PYTHON.builder("py").allowTo().markLossless(), python],
    [CommonFormats.SH.builder("sh").allowTo().markLossless(), shell],
    [CommonFormats.BATCH.builder("bat").allowTo().markLossless(), batch],
    [{
      name: "Go Source File",
      format: "go",
      extension: "go",
      mime: "text/x-go",
      from: false,
      to: true,
      internal: "go",
      category: "code",
      lossless: true,
    }, go],
    [{
      name: "C# Source File",
      format: "cs",
      extension: "cs",
      mime: "text/csharp",
      from: false,
      to: true,
      internal: "csharp",
      category: "code",
      lossless: true,
    }, csharp],
  ];

  public name: string = "textToSource";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;

  async init () {
    const formats = textToSourceHandler.converters.map(([format]) => format);
    this.supportedFormats = [
      CommonFormats.TEXT.builder("txt").allowFrom().markLossless(),
    ];
    this.supportedFormats.push(...formats);

    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];
    const converterEntry = textToSourceHandler.converters.find(
      ([format]) => format.internal === outputFormat.internal
    );

    if (!converterEntry) {
      throw new Error(`could not find a textToSource converter to convert to ${outputFormat.mime}`);
    }

    const [, converter] = converterEntry;

    for (const inputFile of inputFiles) {
      const text = new TextDecoder().decode(inputFile.bytes);

      const converted = converter(text);

      const bytes = new TextEncoder().encode(converted);
      const name = inputFile.name.replace(/\.txt$/i, `.${outputFormat.extension}`);
      outputFiles.push({ bytes, name });
    }
    return outputFiles;
  }

}

export default textToSourceHandler;
