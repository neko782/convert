#!/bin/sh
# Windows x86-64 executable that runs the batch script appended to it (see
# stub.c), built with the llvm-mingw toolchain.
set -eu

x86_64-w64-mingw32-clang \
  -std=c11 -Os -Wall -Wextra -Werror -municode -static -s \
  -ffile-prefix-map="$RECIPE"=. -ffunction-sections -fdata-sections \
  -Wl,--gc-sections -Wl,--no-insert-timestamp -Wl,--build-id=none \
  -o "$OUT/stub.exe" "$RECIPE/stub.c"
