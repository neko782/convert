#!/bin/sh
set -eu

cd "$SRC/7z-wasm"
make -C CPP/7zip/Bundles/Alone2 -j"$JOBS" -f makefile.emcc \
  CC=emcc CXX=em++ AR=emar ST_MODE=1 \
  LDFLAGS_EMCC="-O2 -sDEFAULT_TO_CXX=1 -lnodefs.js -lworkerfs.js \
    -sEXPORTED_RUNTIME_METHODS=FS,NODEFS,WORKERFS,callMain \
    -sALLOW_MEMORY_GROWTH=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=SevenZip \
    --post-js post.js --pre-js pre.js"

cp CPP/7zip/Bundles/Alone2/_o/7zz.js "$OUT/7zz.es6.js"
cp CPP/7zip/Bundles/Alone2/_o/7zz.wasm "$OUT/"
cp "$RECIPE/7zz.es6.d.ts" "$OUT/"
mkdir "$OUT/DOC"
cp DOC/License.txt DOC/unRarLicense.txt "$OUT/DOC/"
