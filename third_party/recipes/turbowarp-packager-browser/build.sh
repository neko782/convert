#!/bin/sh
# Bundle upstream's browser target with Bun; bun.lock pins its dependencies.
set -eu

cd "$SRC/turbowarp-packager-browser"
cp "$RECIPE/bun.lock" bun.lock
"$BUN" install --frozen-lockfile --ignore-scripts
# Webpack 4 runs under Bun instead of requiring an older Node release.
NODE_ENV=production BUILD_MODE=browser "$BUN" run --bun webpack
cp -R dist "$OUT/dist"
