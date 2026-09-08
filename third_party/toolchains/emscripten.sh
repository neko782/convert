#!/bin/sh
# emscripten release binaries plus node, laid out like an emsdk installation:
# upstream/ holds emscripten and its LLVM/Binaryen, node/ the node release.
# The prebuilt system library cache ships inside upstream/emscripten/cache and
# grows there when a build needs a variant that is not prebuilt.
set -eu

mv "$SRC/emscripten" "$DEST/upstream"
mv "$SRC/node" "$DEST/node"

cat > "$DEST/.emscripten" <<EOF
LLVM_ROOT = '$DEST/upstream/bin'
BINARYEN_ROOT = '$DEST/upstream'
EMSCRIPTEN_ROOT = '$DEST/upstream/emscripten'
NODE_JS = '$DEST/node/bin/node'
EOF

cat > "$DEST/env.sh" <<EOF
export EM_CONFIG='$DEST/.emscripten'
export EMSDK_NODE='$DEST/node/bin/node'
export PATH='$DEST/upstream/emscripten:$DEST/node/bin':"\$PATH"
EOF

# Run the sanity check once so the first recipe does not pay for it.
EM_CONFIG="$DEST/.emscripten" "$DEST/upstream/emscripten/emcc" --check
