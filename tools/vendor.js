// Download, verify and prepare the entries declared in third_party/sources.js.
// Usage: bun tools/vendor.js [--force]
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import sources from "../third_party/sources.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generated = join(root, "third_party/generated");
const patchesDir = join(root, "third_party/patches");
const recipesDir = join(root, "third_party/recipes");
const downloadCache = join(root, ".cache/vendor");
const force = process.argv.includes("--force");

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, BUN: process.execPath },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
}

// Directories are rebuilt from scratch whenever their fingerprint changes.
function upToDate(dest, fingerprint) {
  if (force) return false;
  const stamp = join(dest, ".vendored");
  return existsSync(stamp) && readFileSync(stamp, "utf8") === fingerprint;
}

function fresh(dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
}

function stamp(dest, fingerprint) {
  writeFileSync(join(dest, ".vendored"), fingerprint);
}

async function download(url, expected) {
  mkdirSync(downloadCache, { recursive: true });
  const file = join(
    downloadCache,
    expected + (url.endsWith(".zip") ? ".zip" : ".tar.gz"),
  );
  if (!existsSync(file) || sha256(readFileSync(file)) !== expected) {
    console.log(`vendor: downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const data = new Uint8Array(await response.arrayBuffer());
    const actual = sha256(data);
    if (actual !== expected)
      throw new Error(`${url}: sha256 ${actual}, expected ${expected}`);
    writeFileSync(file, data);
  }
  return file;
}

async function extract(archive, dir, strip) {
  if (!archive.endsWith(".zip")) {
    run("tar", ["-xzf", archive, "-C", dir, `--strip-components=${strip}`]);
    return;
  }
  const zip = await JSZip.loadAsync(readFileSync(archive));
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const parts = entry.name.split("/").slice(strip);
    if (parts.length === 0) continue;
    const target = join(dir, ...parts);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, await entry.async("uint8array"));
  }
}

async function vendor(entry) {
  const dest = entry.output
    ? join(root, entry.output)
    : join(generated, entry.name);
  const patches = (entry.patches ?? []).map((p) => join(patchesDir, p));
  const fingerprint = JSON.stringify([
    entry,
    patches.map((p) => sha256(readFileSync(p))),
    entry.build
      ? recipeFingerprint(dirname(join(recipesDir, entry.build)))
      : null,
  ]);
  if (upToDate(dest, fingerprint)) return;

  const archive = await download(entry.url, entry.sha256);
  const scratch = mkdtempSync(join(tmpdir(), "vendor-"));
  try {
    await extract(archive, scratch, entry.strip ?? 1);
    for (const patch of patches) {
      run("git", ["apply", "-p1", "--whitespace=nowarn", patch], scratch);
    }
    fresh(dest);
    if (entry.build) {
      run("sh", [join(recipesDir, entry.build), scratch, dest], root);
    } else
      for (const [from, to] of Object.entries(entry.copy ?? { ".": "." })) {
        const target = join(dest, to);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(join(scratch, from), target, { recursive: true });
      }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  stamp(dest, fingerprint);
  console.log(`vendor: ${entry.name} <- ${basename(entry.url)}`);
}

function recipeFingerprint(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => [
      entry.name,
      entry.isDirectory()
        ? recipeFingerprint(join(dir, entry.name))
        : sha256(readFileSync(join(dir, entry.name))),
    ]);
}

function unpackArtifacts(entry) {
  const archive = join(recipesDir, entry.name, "artifacts.tar.gz");
  const dest = entry.output
    ? join(root, entry.output)
    : join(generated, entry.name);
  const fingerprint = JSON.stringify([entry, sha256(readFileSync(archive))]);
  if (upToDate(dest, fingerprint)) return;
  fresh(dest);
  run("tar", ["-xzf", archive, "-C", dest]);
  stamp(dest, fingerprint);
  console.log(
    `vendor: ${entry.name} <- recipes/${entry.name}/artifacts.tar.gz`,
  );
}

for (const entry of sources) {
  if (entry.artifacts) unpackArtifacts(entry);
  else await vendor(entry);
}

const wanted = new Set(
  sources.filter((entry) => !entry.output).map((entry) => entry.name),
);
for (const name of readdirSync(generated)) {
  if (!wanted.has(name)) {
    rmSync(join(generated, name), { recursive: true, force: true });
    console.log(`vendor: removed stale ${name}`);
  }
}
