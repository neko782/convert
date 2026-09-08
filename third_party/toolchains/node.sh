#!/bin/sh
set -eu

mv "$SRC/node" "$DEST/node"

cat > "$DEST/env.sh" <<EOF2
export PATH='$DEST/node/bin':"\$PATH"
EOF2
