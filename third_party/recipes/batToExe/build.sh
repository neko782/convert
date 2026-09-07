#!/bin/sh
set -eu
. /recipes/lib.sh

fetch_extract \
  https://github.com/mstorsjo/llvm-mingw/releases/download/20260826/llvm-mingw-20260826-ucrt-ubuntu-22.04-x86_64.tar.xz \
  cee8d2ce3da5145ce4dc882e70d0b0719a783d53a99752c60948fc0659975a65 \
  /build/llvm-mingw

/build/llvm-mingw/bin/x86_64-w64-mingw32-clang \
  -std=c11 -Os -Wall -Wextra -Werror -municode -static -s \
  -ffile-prefix-map="$RECIPE"=. -ffunction-sections -fdata-sections \
  -Wl,--gc-sections -Wl,--no-insert-timestamp -Wl,--build-id=none \
  -o "$OUT/stub.exe" "$RECIPE/stub.c"
