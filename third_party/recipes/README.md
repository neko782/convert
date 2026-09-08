# Third-party recipes

Recipes are declared in [../sources.js](../sources.js): every archive a build
needs (the main `source` and additional `sources`, each with URL and checksum),
the `build` script path relative to this directory, the `artifacts` flag, and
for artifact recipes the `toolchains` from [../toolchains.js](../toolchains.js)
and `options` they use.

A directory contains a `build.sh` recipe and its supporting files (lockfiles,
type declarations, small C sources). The result, `../prebuilt/<name>-<key>.tar.gz`,
is checked into Git. If the script is trivial enough to rerun on each build, use
`artifacts: false`. Patches live in `../patches/` and are declared per source;
the driver applies them before the recipe runs.

## Keys

`<key>` is the SHA-256 of everything that goes into a build: the manifest entry
(sources, checksums, options), patch contents, the recipe directory, the
identity of each toolchain (its sources, setup script and platform), the
platform and the container definition. `tools/manifest.js` computes it.
Changing any input gives a new key, and `bun run vendor` refuses to use an
archive built for an old one, so a checked-in archive always corresponds to the
checked-in inputs. Dependencies are exact: a recipe names the toolchains it
uses, and nothing is versioned, compared or solved.

The container ([Dockerfile](Dockerfile)) is a base image pinned by digest plus
generic build utilities installed from a fixed snapshot of the Ubuntu archive,
so rebuilding it yields the same package versions.

## Rebuilding

```sh
bun run prebuilt <name>...          # build, write ../prebuilt/<name>-<key>.tar.gz
bun run prebuilt --all              # build every artifact recipe
bun run prebuilt --all --missing    # build only recipes whose key has no archive
bun run prebuilt --check <name>...  # build, compare with the checked-in archive
bun run prebuilt --plan <name>...   # print the resolved build steps
bun run prebuilt --trace <name>...  # echo every command the recipe runs
```

Builds run in the container. `third_party/` is mounted read-only. Downloads
(`/downloads`), toolchain installations (`/toolchains`) and ccache results are
Docker volumes shared by all builds: the first recipe to need a toolchain sets
it up, later ones find it under `/toolchains/<name>-<key>`. Set
`CONVERT_DOCKER_NETWORK=host` if the default Docker network has no access to
the download hosts.

## Toolchains

A toolchain in `toolchains.js` is a set of pinned downloads and a setup script in
`../toolchains/`. The setup script runs with `SRC` (extracted sources, one
directory per name) and `DEST` (the installation directory) and must write
`$DEST/env.sh`, which is sourced before the recipe runs (typically to extend
`PATH`). Toolchains that keep caches (emscripten's system libraries, zig's
compiler cache) keep them inside their installation, so they are shared too.

## Writing a recipe

Every recipe entry point is `build.sh`, run with `sh` from an empty working
directory with

- `SRC` - the sources declared in `sources.js`, extracted and patched: the
  main `source` at `$SRC/<name>`, additional `sources` at `$SRC/<source name>`,
- `RECIPE` - the recipe directory (read-only),
- `OUT` - an empty directory; its final contents become the archive and
  `third_party/generated/<name>/`,
- `JOBS` - parallelism for `make -j` and the like,
- `OPT_<NAME>` - the recipe's options,
- `TOOLCHAIN_<NAME>` - the installation directory of each declared toolchain,
  with its `env.sh` already applied.

Recipes must not download anything: declare every input in `sources.js` so it is checksummed and
part of the key. Keep recipes to what upstream's own build does; put deviations
in a patch under `../patches/`.

Vendor-time recipes (`artifacts: false`) run on the host with the same `SRC`,
`OUT` and `RECIPE` variables plus `BUN`, the absolute path to the Bun
executable, and have no toolchains, options or `JOBS`.

## Upgrading

Change the URL and checksum in `sources.js` (or `toolchains.js` for a
toolchain), refresh patches or lockfiles as needed, run `bun run prebuilt
--all --missing` to rebuild every recipe whose key changed, test
the application, and commit the recipe together with the new archive. Old
archives are removed by `prebuilt` when it writes a new one.
