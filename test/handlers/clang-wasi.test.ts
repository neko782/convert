import { expect, test } from "bun:test";
import { useBrowser } from "../browser.js";

const browser = useBrowser();

test.each([
  ["c", "int main(void) { return 0; }"],
  [
    "cpp",
    "#include <vector>\nint main() { std::vector<int> v{1,2}; return v.size(); }",
  ],
])(
  "%s → wasm with the cached Clang runtime",
  async (extension, source) => {
    const magic = await browser.page.evaluate(
      async ({ extension, source }) => {
        const from = window.queryFormatNode(
          (n) =>
            n.handler.name === "clang-wasi" && n.format.internal === extension,
        );
        const to = window.queryFormatNode(
          (n) =>
            n.handler.name === "clang-wasi" && n.format.internal === "wasm",
        );
        if (!from || !to) throw new Error("Clang formats are missing");
        const result = await window.tryConvertByTraversing(
          [
            {
              name: `hello.${extension}`,
              bytes: new TextEncoder().encode(source),
            },
          ],
          from,
          to,
        );
        return result ? Array.from(result.files[0].bytes.slice(0, 4)) : null;
      },
      { extension, source },
    );
    expect(magic).toEqual([0, 97, 115, 109]);
  },
  60000,
);
