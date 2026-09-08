// Loads third_party/sources.js and third_party/toolchains.js, validates them
// and computes the keys that identify toolchain installations and recipe
// outputs. Shared by tools/vendor.js and tools/prebuilt.js.
//
// A key is the SHA-256 of every input that can change the result:
//   toolchain: name, sources (url, sha256, strip), setup script, platform
//   entry:     the manifest entry itself (sources, copy, output, options, ...),
//              patch contents, recipe directory contents, keys of the
//              toolchains it uses, and for artifact recipes the platform they
//              are built on and the container definition.
// Keys are exact identities, not versions: nothing is solved or compared.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sources from "../third_party/sources.js";
import toolchains from "../third_party/toolchains.js";

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const thirdParty = join(root, "third_party");
export const patchesDir = join(thirdParty, "patches");
export const recipesDir = join(thirdParty, "recipes");
export const toolchainsDir = join(thirdParty, "toolchains");
export const prebuiltDir = join(thirdParty, "prebuilt");
export const dockerfile = join(recipesDir, "Dockerfile");

// Docker platform the container and every toolchain download are for.
export const platform = "linux/amd64";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const fileHash = (path) => sha256(readFileSync(path));

// JSON with object keys sorted, so the key does not depend on declaration order.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  if (value === undefined) throw new Error("undefined is not canonical");
  return JSON.stringify(value);
}

const shaPattern = /^[0-9a-f]{64}$/;
const namePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function fail(context, message) {
  throw new Error(`third_party manifest: ${context}: ${message}`);
}

function checkSource(context, source, { allowPatches }) {
  if (typeof source.url !== "string" || !/^https:\/\//.test(source.url))
    fail(context, "url must be an https URL");
  if (!shaPattern.test(source.sha256 ?? ""))
    fail(context, "sha256 must be 64 hex characters");
  if (source.strip !== undefined && ![0, 1].includes(source.strip))
    fail(context, "strip must be 0 or 1");
  if (source.patches !== undefined) {
    if (!allowPatches) fail(context, "patches are not allowed here");
    for (const patch of source.patches)
      if (!existsSync(join(patchesDir, patch)))
        fail(context, `missing patch ${patch}`);
  }
}

function checkSources(context, entrySources, options) {
  if (!entrySources || typeof entrySources !== "object")
    fail(context, "sources must be an object");
  for (const [name, source] of Object.entries(entrySources)) {
    if (!namePattern.test(name)) fail(context, `invalid source name ${name}`);
    checkSource(`${context} source ${name}`, source, options);
  }
}

// The main source of an entry or toolchain is declared on the object itself
// (url, sha256, strip, patches) and extracted as $SRC/<its name>; additional
// ones live in `sources`. Both as one name -> source map, main source first.
export function allSources(name, item) {
  const main = {};
  for (const field of ["url", "sha256", "strip", "patches"])
    if (item[field] !== undefined) main[field] = item[field];
  return {
    ...(item.url !== undefined ? { [name]: main } : {}),
    ...(item.sources ?? {}),
  };
}
export const entrySources = (entry) => allSources(entry.name, entry);

function checkItem(context, item, options) {
  if (item.url !== undefined || item.sha256 !== undefined)
    checkSource(context, item, options);
  if (item.sources !== undefined) checkSources(context, item.sources, options);
  if (item.sources?.[context.split(" ").pop()])
    fail(context, "sources must not reuse the main name");
}

for (const [name, toolchain] of Object.entries(toolchains)) {
  if (!namePattern.test(name)) fail("toolchains", `invalid name ${name}`);
  if (
    typeof toolchain.setup !== "string" ||
    !existsSync(join(toolchainsDir, toolchain.setup))
  )
    fail(`toolchain ${name}`, "setup must name a script under toolchains/");
  checkItem(`toolchain ${name}`, toolchain, { allowPatches: false });
  if (toolchain.url === undefined)
    fail(`toolchain ${name}`, "needs a main url and sha256");
}

const seen = new Set();
for (const entry of sources) {
  const context = `entry ${entry.name}`;
  if (!namePattern.test(entry.name ?? "")) fail("sources", "invalid name");
  if (seen.has(entry.name)) fail(context, "declared twice");
  seen.add(entry.name);
  checkItem(context, entry, { allowPatches: true });
  if (entry.build) {
    if (!existsSync(join(recipesDir, entry.build)))
      fail(context, `missing recipe ${entry.build}`);
    if (entry.copy) fail(context, "copy applies to entries without build");
  } else {
    if (entry.url === undefined || entry.sources)
      fail(context, "entries without build need exactly one source");
    if (entry.toolchains || entry.options || entry.artifacts)
      fail(context, "toolchains, options and artifacts need build");
  }
  if (entry.artifacts) {
    for (const name of entry.toolchains ?? [])
      if (!toolchains[name]) fail(context, `unknown toolchain ${name}`);
    for (const [key, value] of Object.entries(entry.options ?? {})) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key))
        fail(context, `option ${key} must be an upper-case identifier`);
      if (typeof value !== "string")
        fail(context, `option ${key} must be a string`);
    }
  } else if (entry.toolchains || entry.options) {
    fail(context, "toolchains and options apply to artifact recipes only");
  }
}

export { sources, toolchains };

// Sorted [relative path, sha256] pairs for every file below dir.
export function directoryFingerprint(dir, prefix = "") {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const path = join(dir, entry.name);
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      result.push(...directoryFingerprint(path, relative + "/"));
    else result.push([relative, fileHash(path)]);
  }
  return result;
}

export function recipeDir(entry) {
  return dirname(join(recipesDir, entry.build));
}

const toolchainKeys = new Map();
export function toolchainKey(name) {
  if (!toolchainKeys.has(name)) {
    const toolchain = toolchains[name];
    toolchainKeys.set(
      name,
      sha256(
        canonical({
          name,
          platform,
          setup: fileHash(join(toolchainsDir, toolchain.setup)),
          sources: allSources(name, toolchain),
        }),
      ),
    );
  }
  return toolchainKeys.get(name);
}

export function entryKey(entry) {
  const patches = {};
  for (const [name, source] of Object.entries(entrySources(entry)))
    for (const patch of source.patches ?? [])
      patches[`${name}/${patch}`] = fileHash(join(patchesDir, patch));
  return sha256(
    canonical({
      entry,
      patches,
      recipe: entry.build ? directoryFingerprint(recipeDir(entry)) : null,
      toolchains: Object.fromEntries(
        (entry.toolchains ?? []).map((name) => [name, toolchainKey(name)]),
      ),
      platform: entry.artifacts ? platform : null,
      container: entry.artifacts ? fileHash(dockerfile) : null,
    }),
  );
}

// Checked-in build result of an artifact recipe for its current key.
export function artifactPath(entry, key = entryKey(entry)) {
  return join(prebuiltDir, `${entry.name}-${key}.tar.gz`);
}

// Entry name of a file in prebuilt/, or null if it is not an artifact archive.
export function artifactEntryName(file) {
  return /^(.+)-[0-9a-f]{64}\.tar\.gz$/.exec(file)?.[1] ?? null;
}

export function outputDir(entry) {
  return entry.output
    ? join(root, entry.output)
    : join(thirdParty, "generated", entry.name);
}
