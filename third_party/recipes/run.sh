#!/bin/sh
# Container entry point used by tools/prebuilt.js: runs one recipe, then writes
# a normalized artifacts.tar.gz of $OUT to stdout. Build logs go to stderr.
# Normalizing (fixed order, epoch mtime, root owner, 644/755 modes, no gzip
# timestamp) makes the archive a function of the recipe output alone, so two
# builds can be compared byte for byte.
set -eu

mkdir -p "$OUT"
sh "$BUILD_SCRIPT" >&2

find "$OUT" -type d -exec chmod 755 {} +
find "$OUT" -type f -exec chmod 644 {} +
tar -C "$OUT" --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
  --format=gnu -cf - . | gzip -n
