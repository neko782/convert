import { expect, test } from "bun:test";
import { useBrowser } from "../browser.js";

const browser = useBrowser();

test("ImageMagick converts PNG to TIFF with the upgraded WASM asset", async () => {
  const result = await browser.page.evaluate(async () => {
    const from = window.queryFormatNode(
      (n) => n.handler.name === "ImageMagick" && n.format.internal === "PNG",
    );
    const to = window.queryFormatNode(
      (n) => n.handler.name === "ImageMagick" && n.format.internal === "TIFF",
    );
    if (!from || !to) throw new Error("ImageMagick formats are missing");
    const converted = await window.tryConvertByTraversing(
      [
        {
          name: "colors.png",
          bytes: new Uint8Array(
            await fetch("/test/colors_50x50.png").then((r) => r.arrayBuffer()),
          ),
        },
      ],
      from,
      to,
    );
    return converted ? Array.from(converted.files[0].bytes.slice(0, 4)) : null;
  });
  expect([
    [73, 73, 42, 0],
    [77, 77, 0, 42],
  ]).toContainEqual(result);
}, 60000);
