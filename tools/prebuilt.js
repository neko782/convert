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
// recipe directory is mounted, read-only; downloads and compiler results are
// cached in Docker volumes; the archive comes back on stdout (see run.sh).
// Clear compiler results with: docker volume rm convert-prebuilt-ccache

import { createHash, randomUUID } from "node:crypto";
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

const container = `convert-prebuilt-${randomUUID()}`;

async function docker(args, stdout = "inherit") {
  const child = Bun.spawn(["docker", ...args], {
    stdin: "ignore",
    stdout,
    stderr: "inherit",
  });
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    child.kill("SIGKILL");
  };
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const status = await child.exited;
    if (cancelled || status !== 0)
      throw new Error(
        `docker ${args[0]} failed (${cancelled ? "cancelled" : `exit ${status}`})`,
      );
  } finally {
    if (args[0] === "run")
      spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

let image = process.env.CONVERT_TOOLCHAIN_IMAGE;
if (!image) {
  image = "convert-toolchain";
  await docker([
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
    ["--init", "--name", container],
    ["--platform", platform],
    network,
    ["--volume", `${recipesDir}:/recipes:ro`],
    ["--volume", "convert-prebuilt-downloads:/downloads"],
    ["--volume", "convert-prebuilt-ccache:/ccache"],
    ["--env", "CCACHE_DIR=/ccache"],
    ["--env", "CCACHE_MAXSIZE=10G"],
    ["--env", "CCACHE_COMPILERCHECK=content"],
    ["--env", `CONVERT_LLVM_LTO=${process.env.CONVERT_LLVM_LTO ?? "1"}`],
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
    await docker(
      ["run", "--rm", ...options, image, "sh", "/recipes/run.sh"],
      fd,
    );
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
