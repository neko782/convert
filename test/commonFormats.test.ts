import { expect, test } from "bun:test";
import type {
  FileData,
  FormatHandler,
  FileFormat,
} from "../src/FormatHandler.js";
import CommonFormats from "../src/CommonFormats.js";
import { useBrowser } from "./browser.js";

const browser = useBrowser();

const dummyHandler: FormatHandler = {
  name: "dummy",
  ready: true,
  async init() {},
  async doConvert(inputFiles, inputFormat, outputFormat, args) {
    return [];
  },
};

function attemptConversion(files: string[], from: FileFormat, to: FileFormat) {
  return browser.page.evaluate(
    async (testFileNames, from, to) => {
      const files: FileData[] = [];
      for (const fileName of testFileNames) {
        files.push({
          bytes: await fetch("/test/" + fileName).then((r) => r.bytes()),
          name: fileName,
        });
      }
      return await window.tryConvertByTraversing(files, from, to);
    },
    files,
    { format: from, handler: dummyHandler },
    { format: to, handler: dummyHandler },
  );
}

// ==================================================================
//                         START OF TESTS
// ==================================================================

test(
  "png → jpeg",
  async () => {
    const conversion = await attemptConversion(
      ["colors_50x50.png"],
      CommonFormats.PNG,
      CommonFormats.JPEG,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "image/png",
      "image/jpeg",
    ]);
  },
  { timeout: 60000 },
);

test(
  "png → svg",
  async () => {
    const conversion = await attemptConversion(
      ["colors_50x50.png"],
      CommonFormats.PNG,
      CommonFormats.SVG,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "image/png",
      "image/svg+xml",
    ]);
  },
  { timeout: 60000 },
);

test(
  "mp4 → apng",
  async () => {
    const conversion = await attemptConversion(
      ["doom.mp4"],
      CommonFormats.MP4,
      CommonFormats.PNG.builder("apng").withFormat("apng"),
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.format)).toEqual([
      "mp4",
      "apng",
    ]);
    expect(conversion?.files.length).toBe(1);
  },
  { timeout: 60000 },
);

test(
  "png → mp4",
  async () => {
    const conversion = await attemptConversion(
      ["colors_50x50.png"],
      CommonFormats.PNG,
      CommonFormats.MP4,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "image/png",
      "video/mp4",
    ]);
  },
  { timeout: 60000 },
);

test(
  "png → wav → mp3",
  async () => {
    const conversion = await attemptConversion(
      ["colors_50x50.png"],
      CommonFormats.PNG,
      CommonFormats.MP3,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "image/png",
      "audio/wav",
      "audio/mpeg",
    ]);
  },
  { timeout: 60000 },
);

test(
  "mp3 → wav → png → gif",
  async () => {
    const conversion = await attemptConversion(
      ["gaster.mp3"],
      CommonFormats.MP3,
      CommonFormats.GIF,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "audio/mpeg",
      "audio/wav",
      "image/png",
      "image/gif",
    ]);
    expect(conversion!.files.length).toBe(1);
    expect(Object.values(conversion!.files[0].bytes).slice(0, 3)).toEqual([
      0x47, 0x49, 0x46,
    ]);
  },
  { timeout: 60000 },
);

test(
  "docx → html → svg → png → pdf",
  async () => {
    const conversion = await attemptConversion(
      ["word.docx"],
      CommonFormats.DOCX,
      CommonFormats.PDF,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/html",
      "image/svg+xml",
      "image/png",
      "application/pdf",
    ]);
    const fileSize = Object.values(conversion!.files[0].bytes).length;
    expect(fileSize).toBeWithin(55000, 65000);
  },
  { timeout: 60000 },
);

test(
  "md → docx",
  async () => {
    const conversion = await attemptConversion(
      ["markdown.md"],
      CommonFormats.MD,
      CommonFormats.DOCX,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
  },
  { timeout: 60000 },
);

test(
  "txt → wav → flac",
  async () => {
    const conversion = await attemptConversion(
      ["markdown.md"],
      CommonFormats.TEXT,
      CommonFormats.FLAC,
    );

    expect(conversion).toBeTruthy();
    expect(conversion!.path.map((c) => c.format.mime)).toEqual([
      "text/plain",
      "audio/wav",
      "audio/flac",
    ]);
    expect(conversion!.path[1].handler.name).toBe("espeakng");
  },
  { timeout: 60000 },
);
