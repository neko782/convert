import { expect, test } from "bun:test";
import { useBrowser } from "../browser.js";

const browser = useBrowser();

test("MusicXML → HTML renders an embedded score with vexml", async () => {
  const result = await browser.page.evaluate(async () => {
    const from = window.queryFormatNode(
      (n) => n.handler.name === "VexFlow" && n.format.internal === "musicxml",
    );
    const to = window.queryFormatNode(
      (n) => n.handler.name === "VexFlow" && n.format.internal === "html",
    );
    if (!from || !to) throw new Error("MusicXML formats are missing");
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;
    const converted = await window.tryConvertByTraversing(
      [{ name: "score.musicxml", bytes: new TextEncoder().encode(xml) }],
      from,
      to,
    );
    if (!converted) return null;
    const html = new TextDecoder().decode(converted.files[0].bytes);
    return {
      hasImage: html.includes("data:image/png;base64,"),
      length: html.length,
    };
  });
  expect(result?.hasImage).toBe(true);
  expect(result!.length).toBeGreaterThan(2000);
}, 60000);
