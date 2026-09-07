#!/bin/sh
# Static Linux x86-64 executable that runs the shell script appended to it
# (see stub.c). Built against musl so it has no runtime dependencies.
set -eu

musl-gcc -static -Os -s -ffunction-sections -fdata-sections \
  -Wl,--gc-sections -Wl,--build-id=none \
  -o "$OUT/stub.elf" "$RECIPE/stub.c"
