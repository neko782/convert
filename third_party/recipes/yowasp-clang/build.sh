#!/bin/sh
# YoWASP's LLVM/Clang/LLD toolchain compiled to WebAssembly, packaged for the
# browser the same way as the @yowasp/clang npm package (gen/bundle.js plus the
# wasm and resource files it loads). This is a full LLVM build: several hours.
#
# build.patch adapts upstream's build.sh to a tarball checkout: fixed
# SOURCE_DATE_EPOCH, WASI SDK from $WASI_SDK_PATH, no ccache, libc++ include
# paths for the WASI target.
#
# Provenance of the checked-in artifacts.tar.gz: it is not yet an output of this
# recipe but the published npm package @yowasp/clang@22.0.0-git20542-10
# (https://registry.npmjs.org/@yowasp/clang/-/clang-22.0.0-git20542-10.tgz,
# sha512-V31/z9GrJECKeACTDUyvg2llbEUiFi3bxtL5HSg7H/6sydSxdI/AoVAD9F5ozrfLjotWl0B9rghR87m+DUM/zg==)
# with lib/api.d.ts renamed to gen/bundle.d.ts. Running this recipe replaces it.
set -eu
. /recipes/lib.sh

CLANG_VERSION=22.0.0-git20542-10

fetch_extract "$SOURCE_URL" "$SOURCE_SHA256" clang
fetch_extract https://github.com/YoWASP/llvm-project/archive/97196c8eeb1d495fa43bb8af2fb26af5ef5b89fb.tar.gz \
  f0bc914770aa38773b80dc1e707cb3dd6c015aca1255ac7141f42df6a8818792 clang/llvm-src
fetch_extract https://github.com/WebAssembly/wasi-libc/archive/ac020b86fd44bafe60aa4fa12f407d16e3731329.tar.gz \
  d44bd7fa456aa42c1494767e5ffa00cdbab182d8497a577592a6562629f6f49e clang/wasi-libc-src
fetch_extract https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-29/wasi-sdk-29.0-x86_64-linux.tar.gz \
  87d1d1a2879d139cdc624b968efad3d4a97b8078cdff95e63ac88ecafd1a0171 wasi-sdk

cd clang
patch -p1 < "$RECIPE/build.patch"
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
