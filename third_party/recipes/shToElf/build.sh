#!/bin/sh
# Static Linux x86-64 executable that runs the shell script appended to it
# (see stub.c). Built against musl with zig cc so it has no runtime dependencies.
set -eu

zig cc -target x86_64-linux-musl -static -Os -s \
  -ffile-prefix-map="$RECIPE"=. -ffunction-sections -fdata-sections \
  -Wl,--gc-sections -Wl,--build-id=none \
  -o "$OUT/stub.elf" "$RECIPE/stub.c"
