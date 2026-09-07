import { expect, test } from "bun:test";
import { useBrowser } from "../browser.js";
import JSZip from "@turbowarp/jszip";

const browser = useBrowser();

test("cached 7-Zip converts ZIP → 7z → ZIP without losing file contents", async () => {
  const zip = new JSZip();
  zip.file("hello.txt", "cached compiler artifacts");
  const input = await zip.generateAsync({ type: "uint8array" });
  const result = await browser.page.evaluate(async (bytes) => {
    const node = (internal: string) =>
      window.queryFormatNode(
        (n) => n.handler.name === "sevenZip" && n.format.internal === internal,
      )!;
    const seven = await window.tryConvertByTraversing(
      [{ name: "input.zip", bytes: new Uint8Array(bytes) }],
      node("zip"),
      node("7z"),
    );
    if (!seven) return null;
    const converted = await window.tryConvertByTraversing(
      seven.files,
      node("7z"),
      node("zip"),
    );
    return converted ? Array.from(converted.files[0].bytes) : null;
  }, Array.from(input));
  expect(result).not.toBeNull();
  const output = await JSZip.loadAsync(new Uint8Array(result!));
  expect(await output.file("hello.txt")!.async("string")).toBe(
    "cached compiler artifacts",
  );
}, 60000);
