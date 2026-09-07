#!/bin/sh
# Bundle upstream's browser target with Bun; bun.lock pins its dependencies.
set -eu

recipe=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source_dir=$1
out=$2
cd "$source_dir"
git apply -p1 --whitespace=nowarn "$recipe/browser-build.patch"
cp "$recipe/bun.lock" bun.lock
"$BUN" install --frozen-lockfile --ignore-scripts
# Webpack 4 runs under Bun instead of requiring an older Node release.
NODE_ENV=production BUILD_MODE=browser "$BUN" run --bun webpack
cp -R dist "$out/dist"
