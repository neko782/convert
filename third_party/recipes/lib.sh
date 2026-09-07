# Helpers for the build.sh recipes, sourced with `. /recipes/lib.sh`.
#
# tools/prebuilt.js runs a recipe inside the toolchain image with
#   RECIPE     the recipe's directory (read-only; patches and extra files)
#   OUT        empty directory; whatever the recipe leaves there becomes
#              third_party/generated/<name>/ and artifacts.tar.gz
#   DOWNLOADS  cache for source archives, kept between builds
# and the working directory set to an empty scratch directory.

# fetch <url> <sha256>: download once into $DOWNLOADS, verify, print the path.
fetch() {
  file="$DOWNLOADS/$2-$(basename "$1")"
  if [ ! -f "$file" ]; then
    echo "fetching $1" >&2
    curl -fsSL --retry 3 -o "$file.part" "$1"
    mv "$file.part" "$file"
  fi
  echo "$2  $file" | sha256sum -c --quiet - >&2
  echo "$file"
}

# fetch_extract <url> <sha256> <dir>: fetch and unpack into <dir>, dropping the
# archive's top-level directory.
fetch_extract() {
  mkdir -p "$3"
  tar -xf "$(fetch "$1" "$2")" -C "$3" --strip-components=1
}

JOBS="$(nproc)"
