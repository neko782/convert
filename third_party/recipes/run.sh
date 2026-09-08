#!/bin/sh
# Container entry point used by tools/prebuilt.js. Defines the steps a build
# plan is made of, then runs the plan prebuilt.js generated from the manifest
# (mounted at /plan.sh), and finally writes a normalized artifacts archive of
# $OUT to stdout. Build logs go to stderr.
#
# Layout inside the container:
#   /third_party  the repository's third_party directory, read-only
#   /downloads    archives by checksum, kept between builds (volume)
#   /toolchains   toolchain installations by key, kept between builds (volume)
#   /build        scratch: $SRC (extracted sources) and $OUT (recipe output)
#
# Recipes run from an empty working directory with
#   SRC        the sources declared in sources.js, extracted and patched,
#              one directory per source name (the main source under the
#              entry's name)
#   RECIPE     the recipe's directory (read-only; extra files)
#   OUT        empty directory; whatever the recipe leaves there becomes
#              third_party/generated/<name>/ and the artifacts archive
#   JOBS       parallelism for make -j and the like
#   OPT_<X>    the recipe's options from sources.js
#   TOOLCHAIN_<X>  installation directory of each declared toolchain; their
#              env.sh (PATH and the like) is already in effect
# and must not download anything: every input is declared in the manifest.
#
# Normalizing the archive (fixed order, epoch mtime, root owner, 644/755 modes,
# no gzip timestamp) makes it a function of the recipe output alone, so two
# builds can be compared byte for byte.
set -eu

export SRC=/build/src OUT=/build/out
JOBS="$(nproc)"
export JOBS
mkdir -p "$SRC" "$OUT" "$DOWNLOADS" "$TOOLCHAINS"

# fetch <url> <sha256>: download once into $DOWNLOADS, verify, print the path.
fetch() {
  file="$DOWNLOADS/$2-$(basename "$1")"
  if [ ! -f "$file" ]; then
    echo "fetching $1" >&2
    curl -fsSL --retry 3 -o "$file.part" "$1"
    mv "$file.part" "$file"
  fi
  echo "$2  $file" | sha256sum -c --quiet - >&2
  printf '%s\n' "$file"
}

# unpack <archive> <dir> <strip>: extract, removing <strip> (0 or 1) leading
# path components.
unpack() {
  mkdir -p "$2"
  case "$1" in
    *.zip)
      tmp=$(mktemp -d)
      unzip -q "$1" -d "$tmp"
      if [ "$3" = 0 ]; then
        find "$tmp" -mindepth 1 -maxdepth 1 -exec mv -t "$2" -- {} +
      else
        for top in "$tmp"/* "$tmp"/.[!.]*; do
          [ -e "$top" ] || continue
          find "$top" -mindepth 1 -maxdepth 1 -exec mv -t "$2" -- {} +
        done
      fi
      rm -rf "$tmp"
      ;;
    *) tar -xf "$1" -C "$2" --strip-components="$3" ;;
  esac
}

# Toolchain steps. A plan wraps the sources and setup of each toolchain in
#   if toolchain_missing <name> <key>; then ...; toolchain_setup <script>; fi
#   toolchain_use <name> <key>
# so an installation that is already present is only activated.
toolchain_missing() {
  tc_dir="$TOOLCHAINS/$1-$2"
  if [ -f "$tc_dir/.ready" ]; then return 1; fi
  echo "preparing toolchain $1" >&2
  rm -rf "$tc_dir"
  mkdir -p "$tc_dir"
  tc_src=$(mktemp -d)
}

# toolchain_source <name> <url> <sha256> <strip>
toolchain_source() {
  unpack "$(fetch "$2" "$3")" "$tc_src/$1" "$4"
}

toolchain_setup() {
  if ! (cd "$(mktemp -d)" && SRC="$tc_src" DEST="$tc_dir" sh ${TRACE:+-x} "$1") >&2; then
    echo "run.sh: toolchain setup $1 failed" >&2
    exit 1
  fi
  [ -f "$tc_dir/env.sh" ] || {
    echo "$1 did not write env.sh" >&2
    exit 1
  }
  rm -rf "$tc_src"
  : > "$tc_dir/.ready"
}

toolchain_use() {
  dir="$TOOLCHAINS/$1-$2"
  . "$dir/env.sh"
  export "TOOLCHAIN_$(printf '%s' "$1" | tr 'a-z-' 'A-Z_')=$dir"
}

# source_fetch <name> <url> <sha256> <strip>: extract a recipe source to $SRC/<name>.
source_fetch() {
  unpack "$(fetch "$2" "$3")" "$SRC/$1" "$4"
}

# source_patch <name> <patch file>
source_patch() {
  git -C "$SRC/$1" apply -p1 --whitespace=nowarn "$2"
}

# build <build.sh>: run the recipe from an empty working directory. TRACE=1
# (prebuilt.js --trace) echoes every command the recipe runs.
build() {
  export RECIPE
  RECIPE=$(dirname "$1")
  mkdir -p /build/work
  status=0
  (cd /build/work && sh ${TRACE:+-x} "$1") >&2 || status=$?
  if [ "$status" != 0 ]; then
    echo "run.sh: $1 failed (exit $status)" >&2
    exit "$status"
  fi
}

. /plan.sh

find "$OUT" -type d -exec chmod 755 {} +
find "$OUT" -type f -exec chmod 644 {} +
tar -C "$OUT" --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
  --format=gnu -cf - . | gzip -n
