#!/bin/sh
set -eu

mkdir -p "$DEST/bin"
mv "$SRC/bun/bun" "$DEST/bin/bun"
chmod 755 "$DEST/bin/bun"

cat > "$DEST/env.sh" <<EOF2
export PATH='$DEST/bin':"\$PATH"
EOF2
