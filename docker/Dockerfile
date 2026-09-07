FROM oven/bun:1.4.2 AS build

WORKDIR /app

# git: applies the patches in third_party/patches; chromium: for buildCache.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    git \
    && rm -rf /var/lib/apt/lists/*

# Lifecycle scripts are skipped below, so puppeteer never downloads its own
# browser; point it at the system one.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Dependencies in their own layers so source changes do not redo them.
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY third_party ./third_party
COPY tools ./tools
RUN bun run vendor

COPY . .

RUN bun run build
RUN bun run cache:build

FROM nginx:stable-alpine AS runtime

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/convert

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
