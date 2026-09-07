# Toolchain image for the build.sh recipes in this directory (see tools/prebuilt.js).
# Everything is pinned: the base image by digest, bun by checksum. apt packages
# come from the Ubuntu release the base image ships with.
FROM emscripten/emsdk:6.0.9@sha256:96617f27fe16421588241def73908fd348a7f9d260440ed0d00b36dcf7a063cc

RUN apt-get update && apt-get install -y --no-install-recommends \
    musl-tools \
    ninja-build \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

ARG BUN_VERSION=1.4.2
ARG BUN_SHA256=36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913
RUN curl -fsSL --retry 5 -o /tmp/bun.zip \
      https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip \
    && echo "${BUN_SHA256}  /tmp/bun.zip" | sha256sum -c - \
    && unzip -q /tmp/bun.zip -d /tmp \
    && mv /tmp/bun-linux-x64/bun /usr/local/bin/bun \
    && rm -rf /tmp/bun.zip /tmp/bun-linux-x64

# Toolchain output should not depend on when or where it was built.
ENV SOURCE_DATE_EPOCH=0 TZ=UTC LC_ALL=C.UTF-8 \
    BUN_INSTALL_CACHE_DIR=/downloads/bun

WORKDIR /build
