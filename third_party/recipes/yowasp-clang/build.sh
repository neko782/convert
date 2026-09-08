#!/bin/sh
# YoWASP's LLVM/Clang/LLD toolchain compiled to WebAssembly, packaged for the
# browser the same way as the @yowasp/clang npm package (gen/bundle.js plus the
# wasm and resource files it loads). This is a full LLVM build: several hours.
# OPT_LTO=1 enables LTO for the compiler executables (see the build patch).
set -eu

CLANG_VERSION=23.1.0

cd "$SRC/yowasp-clang"
# Upstream tracks these as submodules; the archive contains them as empty
# directories. Put the declared sources in their place.
rmdir llvm-src wasi-libc-src
mv "$SRC/llvm" llvm-src
mv "$SRC/wasi-libc" wasi-libc-src
# Upstream's script hides some errors (command substitutions with 2>&1);
# run it traced so a failure shows where it happened.
CONVERT_LLVM_LTO="$OPT_LTO" CMAKE_BUILD_PARALLEL_LEVEL="$JOBS" sh -ex ./build.sh

# Upstream's package-npmjs.sh, with the version pinned instead of derived from
# git metadata, and dependencies pinned by npmjs.bun.lock.
cd npmjs
sed "s/__VERSION__/$CLANG_VERSION/" package-in.json > package.json
cp "$RECIPE/npmjs.bun.lock" bun.lock
bun install --frozen-lockfile
bun run transpile
bun run pack
bun run build -- --define:VERSION="\"$CLANG_VERSION\""

mkdir "$OUT/gen"
cp gen/bundle.js gen/llvm-resources.tar gen/*.wasm "$OUT/gen/"
cp lib/api.d.ts "$OUT/gen/bundle.d.ts"
cp ../LICENSE.txt "$OUT/"
