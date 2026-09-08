#!/bin/sh
# zig's compiler caches are kept with the installation so they are shared
# between builds, like emscripten's system library cache.
set -eu

mv "$SRC/zig" "$DEST/zig"
mkdir -p "$DEST/cache"

cat > "$DEST/env.sh" <<EOF2
export PATH='$DEST/zig':"\$PATH"
export ZIG_GLOBAL_CACHE_DIR='$DEST/cache'
export ZIG_LOCAL_CACHE_DIR='$DEST/cache'
EOF2
