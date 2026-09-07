#!/bin/sh
# Single-threaded ffmpeg.wasm core (dist/esm/ffmpeg-core.{js,wasm}) with zlib,
# libogg, libvorbis, LAME and x264. Follows ffmpeg.wasm's own build scripts
# (build/*.sh in its repository) with this project's codec selection.
set -eu
. /recipes/lib.sh

PREFIX="$PWD/prefix"
export CFLAGS="-O3 -msimd128 -I$PREFIX/include"
export CXXFLAGS="$CFLAGS"
export LDFLAGS="-L$PREFIX/lib"
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig"
export EM_PKG_CONFIG_PATH="$PKG_CONFIG_LIBDIR"
mkdir -p "$PREFIX" "$OUT/licenses" "$OUT/dist/esm"

fetch_extract https://zlib.net/zlib-1.3.2.tar.gz \
  bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16 zlib
(cd zlib \
  && emconfigure ./configure --prefix="$PREFIX" --static \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/zlib" && cp zlib/LICENSE "$OUT/licenses/zlib/"

fetch_extract https://downloads.xiph.org/releases/ogg/libogg-1.3.6.tar.xz \
  5c8253428e181840cd20d41f3ca16557a9cc04bad4a3d04cce84808677fa1061 ogg
(cd ogg \
  && emconfigure ./configure --prefix="$PREFIX" --host=i686-linux --disable-shared \
    --disable-dependency-tracking --disable-maintainer-mode \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/ogg" && cp ogg/COPYING "$OUT/licenses/ogg/"

fetch_extract https://downloads.xiph.org/releases/vorbis/libvorbis-1.3.7.tar.xz \
  b33cc4934322bcbf6efcbacf49e3ca01aadbea4114ec9589d1b1e9d20f72954b vorbis
# -mno-ieee-fp is an x86 GCC flag clang does not understand
sed -i 's/-mno-ieee-fp//g' vorbis/configure
(cd vorbis \
  && emconfigure ./configure --prefix="$PREFIX" --host=i686-linux --disable-shared \
    --disable-docs --disable-examples --disable-oggtest \
    --disable-dependency-tracking --disable-maintainer-mode \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/vorbis" && cp vorbis/COPYING "$OUT/licenses/vorbis/"

fetch_extract https://deb.debian.org/debian/pool/main/l/lame/lame_3.100.orig.tar.gz \
  ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e lame
(cd lame \
  && emconfigure ./configure --prefix="$PREFIX" --host=i686-linux --disable-shared \
    --disable-frontend --disable-analyzer-hooks --disable-dependency-tracking --disable-gtktest \
  && emmake make -j"$JOBS" install)
mkdir "$OUT/licenses/lame" && cp lame/COPYING lame/LICENSE "$OUT/licenses/lame/"

fetch_extract https://github.com/mirror/x264/archive/c24e06c2e184345ceb33eb20a15d1024d9fd3497.tar.gz \
  090d730e867fc63631782a1287974635d1237d0fa7c6fd1d09fd543620a56689 x264
(cd x264 \
  && emconfigure ./configure --prefix="$PREFIX" --host=x86-gnu --enable-static \
    --disable-cli --disable-asm --disable-thread --extra-cflags="$CFLAGS" \
  && emmake make -j"$JOBS" install-lib-static)
mkdir "$OUT/licenses/x264" && cp x264/COPYING "$OUT/licenses/x264/"

fetch_extract "$SOURCE_URL" "$SOURCE_SHA256" ffmpeg
fetch_extract https://github.com/ffmpegwasm/ffmpeg.wasm/archive/f876f907c7e9b9bf51d4ed0b913a855a63ae63fc.tar.gz \
  5191762afdd8fdbec457fd2650cc773fcebcfe1d5bcb7e5ee9584e1a78bd3d5b ffmpeg-wasm
cd ffmpeg
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
  -Llibpostproc -Llibswresample -Llibswscale \
  -lavcodec -lavdevice -lavfilter -lavformat -lavutil -lpostproc -lswresample -lswscale \
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
