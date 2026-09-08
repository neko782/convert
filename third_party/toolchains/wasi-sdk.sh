#!/bin/sh
# Clang targeting WASI with its sysroot; exported as WASI_SDK_PATH, the variable
# wasi-sdk's own documentation and YoWASP's build scripts use.
set -eu

mv "$SRC/wasi-sdk" "$DEST/wasi-sdk"

cat > "$DEST/env.sh" <<EOF2
export WASI_SDK_PATH='$DEST/wasi-sdk'
EOF2
