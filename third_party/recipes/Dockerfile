# Container for the build.sh recipes in this directory (see tools/prebuilt.js).
# Deliberately minimal: a base image pinned by digest plus generic build
# utilities from a fixed snapshot of the Ubuntu archive, so the same package
# versions are installed no matter when the image is built. Compilers and
# runtimes come from the toolchains declared in ../toolchains.js, which
# prebuilt.js installs into a shared volume.
FROM ubuntu:24.04@sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517

# snapshot.ubuntu.com is HTTPS only; the base image ships no CA certificates.
# Fetch them from the live archive, then point apt at the snapshot for
# everything else (including re-installing ca-certificates at its snapshot
# version).
ARG APT_SNAPSHOT=20260901T000000Z
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && sed -i "s|^URIs: http://[a-z.]*/ubuntu/|URIs: https://snapshot.ubuntu.com/ubuntu/${APT_SNAPSHOT}|" \
      /etc/apt/sources.list.d/ubuntu.sources \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get update \
    && apt-get install -y --no-install-recommends --allow-downgrades \
    ca-certificates \
    ccache \
    cmake \
    curl \
    g++ \
    git \
    make \
    ninja-build \
    patch \
    pkg-config \
    python3 \
    unzip \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Recipe output should not depend on when or where it was built.
ENV SOURCE_DATE_EPOCH=0 TZ=UTC LC_ALL=C.UTF-8 \
    BUN_INSTALL_CACHE_DIR=/downloads/bun

WORKDIR /build
