#!/bin/sh
# libopenmpt as an ES module (libopenmpt.js + libopenmpt.wasm), built with
# upstream's own emscripten configuration (see wasm.mk).
set -eu

cd "$SRC/libopenmpt"
make -f "$RECIPE/wasm.mk" -j"$JOBS" bin/libopenmpt.js

cp bin/libopenmpt.js bin/libopenmpt.wasm LICENSE "$OUT/"
cp "$RECIPE/libopenmpt.d.ts" "$OUT/"
