# Third-party recipes

Recipes are declared in [../sources.js](../sources.js) with their source URL,
checksum, `build` script path relative to this directory, and `artifacts` flag.

A directory contains a `build.sh` recipe, its supporting files (patches,
lockfiles, type declarations) and the result, `artifacts.tar.gz`. The archive is
checked into Git. If the script is trivial enough to rerun on each build, use
`artifacts: false`.

## Rebuilding

```sh
bun run prebuilt <name>...          # build, write artifacts.tar.gz
bun run prebuilt --check <name>...  # build, compare with the checked-in archive
```

## Writing a recipe

Every recipe entry point is `build.sh`, run with `sh`. During vendoring,
recipes receive the extracted source and output directories as arguments;
`BUN` is the absolute path to the Bun executable for JavaScript/TypeScript tools.

Artifact recipes run in the Docker toolchain, in an empty working directory, with

- `RECIPE` - the recipe directory (read-only),
- `SOURCE_URL`, `SOURCE_SHA256` - the primary source declared in `sources.js`,
- `OUT` - an empty directory; its final contents become the archive and
  `third_party/generated/<name>/`,
- `DOWNLOADS` - a cache for source archives shared between builds.

`/recipes/lib.sh` provides `fetch <url> <sha256>` and
`fetch_extract <url> <sha256> <dir>`, plus `JOBS` for `make -j`. Every download
must carry a checksum. Keep recipes to what upstream's own build does; put
deviations in a patch file next to the recipe.

## Upgrading

Change the primary URL and checksum in `sources.js` (additional build inputs
remain pinned in `build.sh`) (and refresh patches or lockfiles as
needed), run `bun run prebuilt <name>`, test the application, and commit the
recipe together with the new archive.
