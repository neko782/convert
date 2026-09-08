// Toolchains for the artifact recipes in sources.js (see recipes/README.md).
//
// A toolchain is a set of checksum-pinned downloads plus a setup script in
// toolchains/ that turns them into an installation. Installations are shared
// between builds: tools/prebuilt.js keeps them in a Docker volume under
// /toolchains/<name>-<key>, where the key covers the sources, the setup script
// and the platform. Changing any of these produces a new installation and a new
// key for every recipe that uses the toolchain.
//
// setup: script under toolchains/, run with SRC (extracted sources: the main
//   one at $SRC/<toolchain name>, additional ones at $SRC/<source name>) and
//   DEST (the installation directory). It must write $DEST/env.sh, which
//   recipes get sourced before they run.
// url, sha256: the main archive; strip: archive components to remove (default 1).
// sources: additional archives with the same fields, by name.
//
// All downloads are the linux/amd64 builds; that is the only platform recipes
// are built on.

export default {
  // emscripten release binaries (what `emsdk install` downloads) and the node
  // release emsdk pairs with it. Release hash from emsdk's
  // emscripten-releases-tags.json.
  emscripten: {
    setup: "emscripten.sh",
    url: "https://storage.googleapis.com/webassembly/emscripten-releases-builds/linux/f04ea239d533260dd1db760dd2d668d5f9a88d6b/wasm-binaries.tar.xz",
    sha256: "d5c6c2917fbc1cae1a7d1e581f1c0b2817369dd57f94c7a0d05921476f1a7287",
    sources: {
      node: {
        url: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz",
        sha256:
          "14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647",
      },
    },
  },
  node: {
    setup: "node.sh",
    url: "https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz",
    sha256: "14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647",
  },
  bun: {
    setup: "bun.sh",
    url: "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip",
    sha256: "36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913",
  },
  "llvm-mingw": {
    setup: "llvm-mingw.sh",
    url: "https://github.com/mstorsjo/llvm-mingw/releases/download/20260826/llvm-mingw-20260826-ucrt-ubuntu-22.04-x86_64.tar.xz",
    sha256: "cee8d2ce3da5145ce4dc882e70d0b0719a783d53a99752c60948fc0659975a65",
  },
  "wasi-sdk": {
    setup: "wasi-sdk.sh",
    url: "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-29/wasi-sdk-29.0-x86_64-linux.tar.gz",
    sha256: "87d1d1a2879d139cdc624b968efad3d4a97b8078cdff95e63ac88ecafd1a0171",
  },
  // zig cc as a self-contained C compiler for static x86-64 Linux (musl).
  zig: {
    setup: "zig.sh",
    url: "https://ziglang.org/download/0.15.2/zig-x86_64-linux-0.15.2.tar.xz",
    sha256: "02aa270f183da276e5b5920b1dac44a63f1a49e55050ebde3aecc9eb82f93239",
  },
};
