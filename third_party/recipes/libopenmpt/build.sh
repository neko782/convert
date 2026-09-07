#!/bin/sh
# libopenmpt as an ES module (libopenmpt.js + libopenmpt.wasm), built with
# upstream's own emscripten configuration (see wasm.mk).
set -eu
. /recipes/lib.sh

fetch_extract "$SOURCE_URL" "$SOURCE_SHA256" libopenmpt
cd libopenmpt

make -f "$RECIPE/wasm.mk" -j"$JOBS" bin/libopenmpt.js

cp bin/libopenmpt.js bin/libopenmpt.wasm LICENSE "$OUT/"
cp "$RECIPE/libopenmpt.d.ts" "$OUT/"
