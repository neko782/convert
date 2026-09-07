import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";

const nodeModulesDir = fileURLToPath(
  new URL("./node_modules", import.meta.url),
);

/**
 * Resolves explicit `node_modules/...` imports (used for `?url` assets) to
 * absolute file paths.
 *
 * This deliberately is NOT a `resolve.alias` entry: Vite's `vite:pre-alias`
 * plugin treats aliased bare imports that land in node_modules as
 * dependencies to pre-bundle, even for `?url` imports. That makes it
 * "discover" e.g. `ffmpeg-core.js?url` at runtime, re-run the optimizer with
 * a `.js?url` entry (which crashes esbuild) and 504 every already-served dep,
 * leaving the dev server with a blank page.
 */
function nodeModulesResolver() {
  return {
    name: "convert:node-modules-resolver",
    enforce: "pre",
    resolveId(id) {
      if (id.startsWith("node_modules/")) {
        return nodeModulesDir + id.slice("node_modules".length);
      }
    },
  };
}

export default defineConfig({
  publicDir: "public",
  resolve: {
    tsconfigPaths: true,
    alias: {
      "turbowarp-packager-browser": fileURLToPath(
        new URL(
          "./third_party/generated/turbowarp-packager-browser/dist/packager.browser.js",
          import.meta.url,
        ),
      ),
    },
  },
  optimizeDeps: {
    include: ["turbowarp-packager-browser"],
    exclude: ["@ffmpeg/ffmpeg", "@sqlite.org/sqlite-wasm"],
  },
  base: "./",
  worker: {
    format: "es",
    plugins: () => [nodeModulesResolver()],
  },
  build: {
    commonjsOptions: {
      include: [
        /node_modules/,
        /turbowarp-packager-browser\/dist\/packager\.browser\.js$/,
      ],
    },
    rollupOptions: {
      output: {
        assetFileNames(assetInfo) {
          const source = assetInfo.originalFileNames?.[0] || "";
          const fileName = source.split(/[\\/]/).pop();

          const unhashedAssets = new Set([
            "espeakng.worker.js",
            "espeakng.worker.data",
          ]);

          if (fileName && unhashedAssets.has(fileName)) {
            return "assets/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  plugins: [
    nodeModulesResolver(),
    preact({
      prefreshEnabled: false,
      reactAliasesEnabled: true,
    }),
  ],
});
