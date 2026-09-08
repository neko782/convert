// Download, verify and prepare the entries declared in third_party/sources.js.
// Usage: bun tools/vendor.js [--force]
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
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

import {
  artifactEntryName,
  artifactPath,
  entryKey,
  entrySources,
  outputDir,
  patchesDir,
  prebuiltDir,
  recipeDir,
  recipesDir,
  root,
  sha256,
  sources,
  thirdParty,
} from "./manifest.js";

const generated = join(thirdParty, "generated");
const downloadCache = join(root, ".cache/vendor");
const force = process.argv.includes("--force");

function run(cmd, args, cwd, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, BUN: process.execPath, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})`);
}

// Directories are rebuilt from scratch whenever their key changes.
function upToDate(dest, key) {
  if (force) return false;
  const stamp = join(dest, ".vendored");
  return existsSync(stamp) && readFileSync(stamp, "utf8") === key;
}

function fresh(dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
}

function stamp(dest, key) {
  writeFileSync(join(dest, ".vendored"), key);
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
  mkdirSync(dir, { recursive: true });
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

// Extract and patch every source of an entry into <scratch>/<source name>.
async function prepareSources(entry, scratch) {
  for (const [name, source] of Object.entries(entrySources(entry))) {
    const dir = join(scratch, name);
    await extract(
      await download(source.url, source.sha256),
      dir,
      source.strip ?? 1,
    );
    for (const patch of source.patches ?? [])
      run(
        "git",
        ["apply", "-p1", "--whitespace=nowarn", join(patchesDir, patch)],
        dir,
      );
  }
}

async function vendor(entry) {
  const dest = outputDir(entry);
  const key = entryKey(entry);
  if (upToDate(dest, key)) return;

  const scratch = mkdtempSync(join(tmpdir(), "vendor-"));
  try {
    await prepareSources(entry, scratch);
    fresh(dest);
    if (entry.build) {
      run("sh", [join(recipesDir, entry.build)], root, {
        SRC: scratch,
        OUT: dest,
        RECIPE: recipeDir(entry),
      });
    } else {
      for (const [from, to] of Object.entries(entry.copy ?? { ".": "." })) {
        const target = join(dest, to);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(join(scratch, entry.name, from), target, { recursive: true });
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  stamp(dest, key);
  console.log(
    `vendor: ${entry.name} <- ${Object.keys(entrySources(entry)).join(", ")}`,
  );
}

function unpackArtifacts(entry) {
  const key = entryKey(entry);
  const archive = artifactPath(entry, key);
  if (!existsSync(archive))
    throw new Error(
      `vendor: ${entry.name}: no artifacts for key ${key}. ` +
        `Its inputs changed since the checked-in archive was built; ` +
        `run \`bun run prebuilt ${entry.name}\` and commit ${relative(root, archive)}.`,
    );
  const dest = outputDir(entry);
  if (upToDate(dest, key)) return;
  fresh(dest);
  run("tar", ["-xzf", archive, "-C", dest]);
  stamp(dest, key);
  console.log(`vendor: ${entry.name} <- ${relative(root, archive)}`);
}

for (const entry of sources) {
  if (entry.artifacts) unpackArtifacts(entry);
  else await vendor(entry);
}

// Archives in prebuilt/ that no artifact recipe refers to any more.
const current = new Set(
  sources
    .filter((entry) => entry.artifacts)
    .map((entry) => artifactPath(entry)),
);
for (const file of readdirSync(prebuiltDir))
  if (artifactEntryName(file) && !current.has(join(prebuiltDir, file)))
    console.warn(`vendor: stale archive third_party/prebuilt/${file}`);

const wanted = new Set(
  sources.filter((entry) => !entry.output).map((entry) => entry.name),
);
mkdirSync(generated, { recursive: true });
for (const name of readdirSync(generated)) {
  if (!wanted.has(name)) {
    rmSync(join(generated, name), { recursive: true, force: true });
    console.log(`vendor: removed stale ${name}`);
  }
}
