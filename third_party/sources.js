// Pinned third-party sources consumed by tools/vendor.js and tools/prebuilt.js.
// name: directory under generated/; output: optional repository-relative override.
// url / sha256: source archive and checksum (url: null for local-only recipes).
// strip: archive components to remove (default 1).
// patches: paths under patches/, applied in order; copy: source/output mapping.
// build: script under recipes/. With artifacts: true, runs in the Docker
// toolchain on explicit rebuild and vendor unpacks recipes/<name>/artifacts.tar.gz.
// With artifacts: false, runs with sh during vendoring, receiving source and
// output directories as arguments. Recipe directory contents invalidate its cache.
// Omit build for sources that only need extracting, patching and copying.

export default [
  {
    name: "envelope",
    url: "https://github.com/p2r3/envelope/archive/2d8bc87d948ccfc391e86724bb0a5d7b1689d5c6.tar.gz",
    sha256: "913bf08c8c058870809ed5b142c7859c63eba0e147cd6807a6f1078053c92778",
  },
  {
    name: "espeakng.js",
    url: "https://github.com/TheZipCreator/espeakng.js/archive/d889d8b9cb07af4e3edb23e41a88adc1c9918414.tar.gz",
    sha256: "958a6391d22464505a156a140fd8d6a6a8e8ca252d469dfb92c72676bb99b801",
  },
  {
    name: "gimper",
    url: "https://github.com/ConnorTippets/gimper/archive/55b5be50f83fd20e353337e7f1df1d3fec25afc7.tar.gz",
    sha256: "05e202757899709feeda03a2b02875446d0fcd30ea3f504f8daa0ebce50c2186",
  },
  {
    name: "image-to-txt",
    url: "https://github.com/zipsegv/image-to-txt/archive/759fcf98a3ba1d079dd73fcce84adf396156548d.tar.gz",
    sha256: "8acba29a08aab6171c42c5155358c3c44a343ea066dee1d3c8a719e069b86a9b",
  },
  {
    name: "qoa-fu",
    url: "https://github.com/pfusik/qoa-fu/archive/ddcf70ec170d35953614a2015d809ede892f4304.tar.gz",
    sha256: "b5961018817763935e49fa99cbfbd9310c046b088abed9984cc9eaf4b93fc1c6",
  },
  {
    name: "qoi-fu",
    url: "https://github.com/pfusik/qoi-fu/archive/2fab2661f2b72fe73643a8ed7be782bd1053f6a2.tar.gz",
    sha256: "121821e657d3ca2b1553260516089f7efc7097a539b6e8ba73b3ed3f801eebf9",
  },
  {
    name: "rpgmvp-decrypter",
    url: "https://github.com/ConnorTippets/RPG-Maker-MV-Decrypter/archive/82ccd8c4e1efcd051ab55ad618c320777c77b350.tar.gz",
    sha256: "a3add518fe9b0030541af7cf01bef8ea45ed216316f63ffd9e64fd78faadb1a4",
  },
  {
    name: "sppd",
    url: "https://github.com/p2r3/sppd/archive/a9d61795b5b3f2c6d06eda09ea3b31bf239e0498.tar.gz",
    sha256: "0fc79a67fd285bcae5b73f55b140a28d10e7d7a74db56bad233b2e5b6deb6014",
  },
  {
    name: "terraria-wld-parser",
    url: "https://github.com/ConnorTippets/terraria-world-file-ts/archive/e0400bfd5ab855e63185f94f892485faff3249d4.tar.gz",
    sha256: "74f5646f6953a887c914dda11df1cd959203a71f49c3e253d29e7c5b82453265",
  },
  {
    name: "turbowarp-unpackager",
    url: "https://github.com/TurboWarp/unpackager/archive/9a8dd22a7095cf7275107a0f6ef113f74b16a505.tar.gz",
    sha256: "b11c47d69c7b4349ff991b70fa429fd60f1193aa6e8db073f5ed616f8571999f",
    // upstream is a browser global / CommonJS hybrid; turn it into an ES module
    patches: ["turbowarp-unpackager-esm.patch"],
  },
  {
    name: "foliate-js",
    url: "https://github.com/johnfactotum/foliate-js/archive/78914aef4466eb960965702401634c2cb348e9b1.tar.gz",
    sha256: "4878cd5f04073af5046ea543da73a963a7f9e1a4b30ddc63ac86cea5adf02f38",
    // createDocument() is consumed directly by the azw3 handler; parse as HTML
    // so malformed KF8 XHTML does not turn into a <parsererror> document.
    patches: ["foliate-js-createDocument-html.patch"],
  },
  {
    name: "pandoc",
    url: "https://github.com/jgm/pandoc/releases/download/3.11/pandoc-3.11.wasm.zip",
    sha256: "bd856c19094f5333ee92f239dd93d288a05429f1d957efef1c37e7bb97ac14bd",
  },
  {
    name: "timgm6mb-soundfont",
    url: "https://deb.debian.org/debian/pool/main/t/timgm6mb-soundfont/timgm6mb-soundfont_1.3.orig.tar.gz",
    sha256: "af8f3a00e416dfb262bcaa904a1c84df04a51b72bbc1313aed012bc754bdf99b",
    copy: { "TimGM6mb.sf2": "TimGM6mb.sf2" },
  },
  {
    name: "material-icon-theme",
    url: "https://github.com/material-extensions/vscode-material-icon-theme/archive/db37396672f801195be1bf082cca76942deb8c24.tar.gz",
    sha256: "50e6c6f640104b7dc3d53d90071b7211a26db7c61ccb63226480c6f90c180a40",
    build: "material-icon-theme/build.sh",
    output: "public/material-file-icons",
  },
  {
    name: "7z-wasm",
    url: "https://github.com/ip7z/7zip/archive/refs/tags/26.03.tar.gz",
    sha256: "74b11efd8559f9b3dc652e89dc8ebdf4acb66e514a745e44cf75582cdf4512fd",
    build: "7z-wasm/build.sh",
    artifacts: true,
  },
  {
    name: "ffmpeg-core",
    url: "https://github.com/FFmpeg/FFmpeg/archive/refs/tags/n5.1.10.tar.gz",
    sha256: "2bef2153333b2eaf04a9caefb419213dd8bd1885b7d591205164fd9c9e50415e",
    build: "ffmpeg-core/build.sh",
    artifacts: true,
  },
  {
    name: "libopenmpt",
    url: "https://lib.openmpt.org/files/libopenmpt/src/libopenmpt-0.8.9+release.makefile.tar.gz",
    sha256: "9273b88b67973cc69e54d748ab1b749399d6d07695f1c37d0c59f88b4106074f",
    build: "libopenmpt/build.sh",
    artifacts: true,
  },
  {
    name: "turbowarp-packager-browser",
    url: "https://github.com/TurboWarp/packager/archive/9a4854b238c5ebfe9ccbbda486382a673c85cd38.tar.gz",
    sha256: "95bebe471a9c7316961526f230ef23d4bd0a37901eb063c543e859c5e35823c6",
    build: "turbowarp-packager-browser/build.sh",
  },
  {
    name: "yowasp-clang",
    url: "https://github.com/YoWASP/clang/archive/944dd7c774954180e621cc8e12984023a7f8bcbe.tar.gz",
    sha256: "518e20345ca6d834074fcc7314b38ec9ff25ef51ccd2588fff66c262418c61e2",
    build: "yowasp-clang/build.sh",
    artifacts: true,
  },
  {
    name: "batToExe",
    url: null,
    build: "batToExe/build.sh",
    artifacts: true,
  },
  {
    name: "shToElf",
    url: null,
    build: "shToElf/build.sh",
    artifacts: true,
  },
];
