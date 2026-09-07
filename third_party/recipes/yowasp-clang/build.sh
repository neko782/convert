#!/bin/sh
# YoWASP's LLVM/Clang/LLD toolchain compiled to WebAssembly, packaged for the
# browser the same way as the @yowasp/clang npm package (gen/bundle.js plus the
# wasm and resource files it loads). This is a full LLVM build: several hours.
#
# build.patch adapts upstream's build.sh to a tarball checkout: fixed
# SOURCE_DATE_EPOCH, WASI SDK from $WASI_SDK_PATH, libc++ include
# paths for the WASI target, and tail calls for Clang's interpreter (including
# LTO linking). llvm-wasi.patch carries YoWASP's platform
# compatibility changes forward to the official LLVM 23.1.0 release.
# LLVM compilation uses the persistent ccache volume provided by prebuilt.js;
# sources and CMake configuration stay fresh on every run. LTO is enabled by
# default to eliminate unused host API imports. Set CONVERT_LLVM_LTO=0 for
# faster iteration. LTO linking is uncached.
#
# The checked-in artifacts.tar.gz is built by this recipe with LTO disabled.
set -eu
. /recipes/lib.sh

CLANG_VERSION=23.1.0

fetch_extract "$SOURCE_URL" "$SOURCE_SHA256" clang
fetch_extract https://github.com/llvm/llvm-project/releases/download/llvmorg-23.1.0/llvm-project-23.1.0.src.tar.xz \
  ab1f0e3ec52448c33e8782eaf0422504b87c7b016b22514653ee0d8fcee479ff clang/llvm-src
fetch_extract https://github.com/WebAssembly/wasi-libc/archive/ac020b86fd44bafe60aa4fa12f407d16e3731329.tar.gz \
  d44bd7fa456aa42c1494767e5ffa00cdbab182d8497a577592a6562629f6f49e clang/wasi-libc-src
fetch_extract https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-29/wasi-sdk-29.0-x86_64-linux.tar.gz \
  87d1d1a2879d139cdc624b968efad3d4a97b8078cdff95e63ac88ecafd1a0171 wasi-sdk

cd clang
patch -p1 < "$RECIPE/build.patch"
patch --fuzz=0 -d llvm-src -p1 < "$RECIPE/llvm-wasi.patch"
WASI_SDK_PATH="$PWD/../wasi-sdk" CMAKE_BUILD_PARALLEL_LEVEL="$JOBS" ./build.sh

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
