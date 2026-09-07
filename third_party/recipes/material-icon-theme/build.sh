#!/bin/sh
set -eu

recipe=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$BUN" "$recipe/extract-material-icons.ts" "$1/src/core/icons/fileIcons.ts" "$2"
