import { expect, test } from "bun:test";
import { useBrowser } from "../browser.js";

const browser = useBrowser();

test("FFmpeg repeatedly encodes and decodes audio without browser isolation", async () => {
  const result = await browser.page.evaluate(async () => {
    const find = (internal: string) => {
      const node = window.queryFormatNode(
        (n) => n.handler.name === "FFmpeg" && n.format.internal === internal,
      );
      if (!node) throw new Error(`FFmpeg format missing: ${internal}`);
      return node;
    };
    const wav = find("wav");
    const mp3 = find("mp3");
    // A quarter-second mono PCM tone, independent of external test assets.
    const samples = 11025;
    const bytes = new Uint8Array(44 + samples * 2);
    const view = new DataView(bytes.buffer);
    const text = (offset: number, value: string) =>
      bytes.set(new TextEncoder().encode(value), offset);
    text(0, "RIFF");
    view.setUint32(4, bytes.length - 8, true);
    text(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 44100, true);
    view.setUint32(28, 88200, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++)
      view.setInt16(
        44 + i * 2,
        Math.round(12000 * Math.sin((i * 2 * Math.PI * 440) / 44100)),
        true,
      );
    const lengths: number[] = [];
    const peaks: number[] = [];
    for (let i = 0; i < 2; i++) {
      const encoded = await window.tryConvertByTraversing(
        [{ name: "tone.wav", bytes }],
        wav,
        mp3,
      );
      if (!encoded) throw new Error("MP3 encoding failed");
      const decoded = await window.tryConvertByTraversing(
        encoded.files,
        mp3,
        wav,
      );
      if (!decoded) throw new Error("MP3 decoding failed");
      const output = decoded.files[0].bytes;
      if (new TextDecoder().decode(output.slice(0, 4)) !== "RIFF")
        throw new Error("Invalid WAV output");
      lengths.push(output.length);
      const pcm = new DataView(
        output.buffer,
        output.byteOffset,
        output.byteLength,
      );
      let peak = 0;
      for (let offset = 12; offset + 8 <= output.length;) {
        const size = pcm.getUint32(offset + 4, true);
        const tag = new TextDecoder().decode(output.slice(offset, offset + 4));
        if (tag === "data") {
          for (
            let j = offset + 8;
            j + 1 < Math.min(offset + 8 + size, output.length);
            j += 2
          )
            peak = Math.max(peak, Math.abs(pcm.getInt16(j, true)));
          break;
        }
        offset += 8 + size + (size & 1);
      }
      peaks.push(peak);
    }
    return { isolated: crossOriginIsolated, lengths, peaks };
  });
  expect(result.isolated).toBe(false);
  expect(result.lengths).toHaveLength(2);
  for (const length of result.lengths) expect(length).toBeGreaterThan(20000);
  for (const peak of result.peaks) expect(peak).toBeGreaterThan(5000);
}, 60000);
