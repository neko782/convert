#!/bin/sh
set -eu

"$BUN" "$RECIPE/extract-material-icons.ts" \
  "$SRC/material-icon-theme/src/core/icons/fileIcons.ts" "$OUT"
