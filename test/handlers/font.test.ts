import { expect, test } from "bun:test";
import { useBrowser } from "../browser.js";

const browser = useBrowser();

test("SVG font → WOFF2 → OTF preserves a usable font", async () => {
  const result = await browser.page.evaluate(async () => {
    const node = (internal: string) =>
      window.queryFormatNode(
        (n) => n.handler.name === "font" && n.format.internal === internal,
      )!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><font id="Test"><font-face font-family="Test" units-per-em="1000" ascent="800" descent="-200"/><glyph unicode="A" horiz-adv-x="600" d="M0 0L300 700L600 0Z"/></font></defs></svg>`;
    const woff = await window.tryConvertByTraversing(
      [{ name: "font.svg", bytes: new TextEncoder().encode(svg) }],
      node("svg"),
      node("woff2"),
    );
    if (!woff) return null;
    const otf = await window.tryConvertByTraversing(
      woff.files,
      node("woff2"),
      node("otf"),
    );
    return {
      woff: new TextDecoder().decode(woff.files[0].bytes.slice(0, 4)),
      otf: otf
        ? new TextDecoder().decode(otf.files[0].bytes.slice(0, 4))
        : null,
    };
  });
  expect(result).toEqual({ woff: "wOF2", otf: "OTTO" });
}, 60000);
