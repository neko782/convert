import { afterAll, beforeAll } from "bun:test";
import puppeteer, { type Browser, type Page } from "puppeteer";
import type { ConvertPathNode, FormatHandler } from "../src/FormatHandler.js";

declare global {
  interface Window {
    queryFormatNode: (
      predicate: (node: ConvertPathNode) => boolean,
    ) => ConvertPathNode | undefined;
  }
}

// Register a separate browser lifecycle for each test file.
export function useBrowser() {
  let server: ReturnType<typeof Bun.serve>;
  let browser: Browser | undefined;
  let page: Page;

  beforeAll(async () => {
    server = Bun.serve({
      port: 0,
      async fetch(req) {
        let path =
          new URL(req.url).pathname.replace("/convert/", "") || "index.html";
        path = path.replaceAll("..", "");
        if (path === "cache.json") return new Response("", { status: 204 }); // to better match the real server
        const file = Bun.file(
          path.startsWith("/test/")
            ? `${__dirname}/resources/${path.slice(6)}`
            : `${__dirname}/../dist/${path}`,
        );
        return (await file.exists())
          ? new Response(file)
          : new Response("Not Found", { status: 404 });
      },
    });
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error(msg.text());
    });
    page.on("pageerror", (error) => console.error(error));

    await Promise.all([
      new Promise<void>((resolve) => {
        const onConsole = (msg: import("puppeteer").ConsoleMessage) => {
          if (msg.text() !== "Built initial format list.") return;
          page.off("console", onConsole);
          resolve();
        };
        page.on("console", onConsole);
      }),
      page.goto(`${server.url}convert/index.html`),
    ]);

    await page.evaluate(() => {
      window.queryFormatNode = (predicate) => {
        for (const [name, formats] of window.supportedFormatCache) {
          for (const format of formats) {
            const node = { format, handler: { name } as FormatHandler };
            if (predicate(node)) return node;
          }
        }
      };
    });
  }, 60000);

  afterAll(async () => {
    try {
      await browser?.close();
    } finally {
      server?.stop();
    }
  });

  return {
    get page() {
      return page;
    },
  };
}
