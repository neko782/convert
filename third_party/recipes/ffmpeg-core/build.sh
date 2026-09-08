#!/bin/sh
# Single-threaded ffmpeg.wasm core (dist/esm/ffmpeg-core.{js,wasm}) with zlib,
# libogg, libvorbis, LAME and x264. Follows ffmpeg.wasm's own build scripts
# (build/*.sh in its repository) with this project's codec selection.
set -eu

PREFIX="$PWD/prefix"
export CFLAGS="-O3 -msimd128 -I$PREFIX/include"
export CXXFLAGS="$CFLAGS"
export LDFLAGS="-L$PREFIX/lib"
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig"
export EM_PKG_CONFIG_PATH="$PKG_CONFIG_LIBDIR"
mkdir -p "$PREFIX" "$OUT/licenses" "$OUT/dist/esm"

(cd "$SRC/zlib" \
  && emconfigure ./configure --prefix="$PREFIX" --static \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/zlib" && cp "$SRC/zlib/LICENSE" "$OUT/licenses/zlib/"

(cd "$SRC/ogg" \
  && emconfigure ./configure --prefix="$PREFIX" --host=i686-linux --disable-shared \
    --disable-dependency-tracking --disable-maintainer-mode \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/ogg" && cp "$SRC/ogg/COPYING" "$OUT/licenses/ogg/"

# -mno-ieee-fp is an x86 GCC flag clang does not understand
sed -i 's/-mno-ieee-fp//g' "$SRC/vorbis/configure"
(cd "$SRC/vorbis" \
  && emconfigure ./configure --prefix="$PREFIX" --host=i686-linux --disable-shared \
    --disable-docs --disable-examples --disable-oggtest \
    --disable-dependency-tracking --disable-maintainer-mode \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/vorbis" && cp "$SRC/vorbis/COPYING" "$OUT/licenses/vorbis/"

(cd "$SRC/lame" \
  && emconfigure ./configure --prefix="$PREFIX" --host=i686-linux --disable-shared \
    --disable-frontend --disable-analyzer-hooks --disable-dependency-tracking --disable-gtktest \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/lame" && cp "$SRC/lame/COPYING" "$SRC/lame/LICENSE" "$OUT/licenses/lame/"

(cd "$SRC/x264" \
  && emconfigure ./configure --prefix="$PREFIX" --host=x86-gnu --enable-static \
    --disable-cli --disable-asm --disable-thread --extra-cflags="$CFLAGS" \
  && emmake make -j"$JOBS" install-lib-static)
mkdir "$OUT/licenses/x264" && cp "$SRC/x264/COPYING" "$OUT/licenses/x264/"

cd "$SRC/ffmpeg-core"
emconfigure ./configure \
  --target-os=none --arch=x86_32 --enable-cross-compile --disable-asm \
  --disable-stripping --disable-programs --disable-doc --disable-debug \
  --disable-runtime-cpudetect --disable-autodetect \
  --disable-pthreads --disable-w32threads --disable-os2threads \
  --enable-gpl --enable-zlib --enable-libx264 --enable-libmp3lame --enable-libvorbis \
  --pkg-config-flags=--static \
  --nm=emnm --ar=emar --ranlib=emranlib --cc=emcc --cxx=em++ --objcc=emcc --dep-cc=emcc \
  --extra-cflags="$CFLAGS" --extra-cxxflags="$CXXFLAGS" --extra-ldflags="$LDFLAGS"
emmake make -j"$JOBS"

# Link the ffmpeg/ffprobe command line tools (ffmpeg.wasm's patched copies)
# into the module, as ffmpeg.wasm's build/ffmpeg-wasm.sh does.
W=../ffmpeg-wasm
emcc $CFLAGS -I. -I"$W/src/fftools" $LDFLAGS \
  -Llibavcodec -Llibavdevice -Llibavfilter -Llibavformat -Llibavutil \
  -Llibswresample -Llibswscale \
  -lavcodec -lavdevice -lavfilter -lavformat -lavutil -lswresample -lswscale \
  -lx264 -lmp3lame -lvorbisenc -lvorbis -logg -lz \
  -Wno-deprecated-declarations \
  -sENVIRONMENT=worker -sWASM_BIGINT -sSTACK_SIZE=5MB -sMODULARIZE -sEXPORT_ES6 \
  -sINITIAL_MEMORY=32MB -sALLOW_MEMORY_GROWTH \
  -sEXPORT_NAME=createFFmpegCore \
  -sEXPORTED_FUNCTIONS="$(node "$W/src/bind/ffmpeg/export.js")" \
  -sEXPORTED_RUNTIME_METHODS="$(node "$W/src/bind/ffmpeg/export-runtime.js")" \
  -lworkerfs.js --pre-js "$W/src/bind/ffmpeg/bind.js" \
  "$W"/src/fftools/cmdutils.c "$W"/src/fftools/ffmpeg.c "$W"/src/fftools/ffmpeg_filter.c \
  "$W"/src/fftools/ffmpeg_hw.c "$W"/src/fftools/ffmpeg_mux.c "$W"/src/fftools/ffmpeg_opt.c \
  "$W"/src/fftools/opt_common.c "$W"/src/fftools/ffprobe.c \
  -o "$OUT/dist/esm/ffmpeg-core.js"

cp COPYING.GPLv2 "$OUT/"
cp "$W/LICENSE" "$OUT/"
