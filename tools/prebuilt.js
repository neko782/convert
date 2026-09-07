// Compiles a dependency that needs a toolchain and stores the result as
// third_party/recipes/<name>/artifacts.tar.gz, which is checked into Git and
// unpacked by tools/vendor.js. Nothing here runs during normal development.
//
// usage: bun tools/prebuilt.js [--check] <name>...
//   <name>   a directory in third_party/recipes/ containing build.sh
//   --check  build but do not write; fail if the result differs from the
//            checked-in archive. Running a build and then --check verifies
//            that the recipe is reproducible.
//
// Recipes run in the toolchain image built from third_party/recipes/Dockerfile
// (set CONVERT_TOOLCHAIN_IMAGE to use an already built image instead). Only the
// recipe directory is mounted, read-only; downloaded sources are cached in a
// Docker volume; the archive comes back on stdout (see run.sh).

import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import sources from "../third_party/sources.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const recipesDir = join(root, "third_party/recipes");
const platform = "linux/amd64";
const network = process.env.CONVERT_DOCKER_NETWORK
  ? ["--network", process.env.CONVERT_DOCKER_NETWORK]
  : [];

const args = process.argv.slice(2);
const check = args.includes("--check");
const names = args.filter((a) => !a.startsWith("--"));
if (names.length === 0) {
  console.error("usage: bun tools/prebuilt.js [--check] <name>...");
  process.exit(2);
}
for (const name of names) {
  const entry = sources.find((entry) => entry.name === name);
  if (!entry?.build || !entry.artifacts)
    throw new Error(`no artifact recipe declared in sources.js: ${name}`);
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function docker(args, stdout = "inherit") {
  const result = spawnSync("docker", args, {
    stdio: ["ignore", stdout, "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`docker ${args[0]} failed (exit ${result.status})`);
}

let image = process.env.CONVERT_TOOLCHAIN_IMAGE;
if (!image) {
  image = "convert-toolchain";
  docker([
    "build",
    "--platform",
    platform,
    ...network,
    "-t",
    image,
    recipesDir,
  ]);
}

let failed = false;
for (const name of names) {
  const entry = sources.find((entry) => entry.name === name);
  const archive = join(recipesDir, name, "artifacts.tar.gz");
  const fresh = archive + ".new";
  console.log(`prebuilt: building ${name}`);
  const options = [
    ["--platform", platform],
    network,
    ["--volume", `${recipesDir}:/recipes:ro`],
    ["--volume", "convert-prebuilt-downloads:/downloads"],
    ["--env", `RECIPE=/recipes/${dirname(entry.build)}`],
    ["--env", `BUILD_SCRIPT=/recipes/${entry.build}`],
    ["--env", `SOURCE_URL=${entry.url ?? ""}`],
    ["--env", `SOURCE_SHA256=${entry.sha256 ?? ""}`],
    ["--env", "OUT=/out"],
    ["--env", "DOWNLOADS=/downloads"],
    ["--workdir", "/build"],
  ].flat();
  const fd = openSync(fresh, "w");
  try {
    docker(["run", "--rm", ...options, image, "sh", "/recipes/run.sh"], fd);
  } catch (error) {
    closeSync(fd);
    unlinkSync(fresh);
    throw error;
  }
  closeSync(fd);

  const before = existsSync(archive) ? sha256(readFileSync(archive)) : null;
  const after = sha256(readFileSync(fresh));
  const same = before === after;
  if (check) {
    unlinkSync(fresh);
    console.log(
      `prebuilt: ${name} ${same ? "reproduced the checked-in archive" : "DIFFERS from the checked-in archive"}`,
    );
    failed ||= !same;
  } else {
    renameSync(fresh, archive);
    console.log(
      `prebuilt: ${name} -> third_party/recipes/${name}/artifacts.tar.gz (${same ? "unchanged" : "updated"})`,
    );
  }
}
process.exit(failed ? 1 : 0);
