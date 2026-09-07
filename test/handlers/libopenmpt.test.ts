import { expect, test } from "bun:test";
import { useBrowser } from "../browser.js";

const browser = useBrowser();

test("cached libopenmpt decodes a ProTracker module to WAV", async () => {
  const result = await browser.page.evaluate(async () => {
    const from = window.queryFormatNode(
      (n) => n.handler.name === "libopenmpt" && n.format.internal === "mod",
    );
    const to = window.queryFormatNode(
      (n) => n.handler.name === "libopenmpt" && n.format.internal === "wav",
    );
    if (!from || !to) throw new Error("Tracker formats are missing");
    // One pattern, one short looping sample, and one C note.
    const mod = new Uint8Array(1084 + 1024 + 64);
    mod.set(new TextEncoder().encode("Cache test"));
    mod[43] = 32;
    mod[45] = 64;
    mod[49] = 32;
    mod[950] = 1;
    mod.set(new TextEncoder().encode("M.K."), 1080);
    mod.set([1, 172, 16, 0], 1084);
    for (let i = 0; i < 64; i++)
      mod[1084 + 1024 + i] =
        Math.round(Math.sin((i * Math.PI) / 32) * 80) & 255;
    const converted = await window.tryConvertByTraversing(
      [{ name: "test.mod", bytes: mod }],
      from,
      to,
    );
    return converted
      ? {
          magic: new TextDecoder().decode(converted.files[0].bytes.slice(0, 4)),
          length: converted.files[0].bytes.length,
        }
      : null;
  });
  expect(result?.magic).toBe("RIFF");
  expect(result!.length).toBeGreaterThan(1000);
}, 60000);
