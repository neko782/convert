// Check the index, including partially staged files, without changing the worktree.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const git = (args, options = {}) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", ...options });
const snapshot = mkdtempSync(join(tmpdir(), "convert-artifacts-"));

try {
  const files = git(["ls-files", "--cached", "-z"]).split("\0").filter(Boolean);
  const inputs = files.filter(
    (file) =>
      file === "tools/manifest.js" ||
      (file.startsWith("third_party/") &&
        !file.startsWith("third_party/prebuilt/") &&
        !file.startsWith("third_party/generated/")),
  );
  git(["checkout-index", `--prefix=${snapshot}${sep}`, "-z", "--stdin"], {
    input: inputs.join("\0") + "\0",
  });
  const { sources, artifactPath, artifactEntryName } = await import(
    pathToFileURL(join(snapshot, "tools/manifest.js")).href
  );
  const staged = new Set(files);
  const expected = new Set();
  const missing = [];
  for (const entry of sources.filter((entry) => entry.artifacts)) {
    const path = relative(snapshot, artifactPath(entry)).split(sep).join("/");
    expected.add(path);
    if (!staged.has(path)) missing.push(`${entry.name}: missing ${path}`);
  }
  const stale = files.filter(
    (file) =>
      file.startsWith("third_party/prebuilt/") &&
      artifactEntryName(file.slice("third_party/prebuilt/".length)) &&
      !expected.has(file),
  );
  if (missing.length || stale.length) {
    console.error(
      "Artifacts are not up to date in the staged commit:\n" +
        [...missing, ...stale.map((file) => `stale archive: ${file}`)]
          .map((message) => `  ${message}`)
          .join("\n") +
        "\nRun `bun run prebuilt --all --missing`, remove any obsolete archives, " +
        "and stage the updated inputs and artifacts before committing.",
    );
    process.exitCode = 1;
  } else {
    console.log("All staged artifacts are up to date.");
  }
} finally {
  rmSync(snapshot, { recursive: true, force: true });
}
