#!/bin/sh
# Clang/LLD/UCRT cross toolchain for Windows targets.
set -eu

mv "$SRC/llvm-mingw" "$DEST/llvm-mingw"

cat > "$DEST/env.sh" <<EOF2
export PATH='$DEST/llvm-mingw/bin':"\$PATH"
EOF2
