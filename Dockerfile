# Thalia runtime image — Bun-first, with Chromium for sites that still use Puppeteer.
#
# Site images typically extend this (set PROJECT to the site folder name):
#   FROM frostickle/thalia:<version>
#   COPY . /usr/app/Thalia/websites/my-site
#   ENV PROJECT=my-site
#   CMD ["bun", "thalia"]
#
# Without PROJECT, the server runs in multiplex mode (all sites under websites/).
# Override at runtime: docker run -e PROJECT=my-site ...
#
# Build (multi-arch):
#   docker buildx build --push --platform linux/arm64,linux/amd64 \
#     --progress=plain --tag frostickle/thalia:1.1.2 .

FROM oven/bun:1.3.14-debian AS base
WORKDIR /usr/app/Thalia

# Chromium for headless browser / Puppeteer. Thalia core does not depend on puppeteer;
# remove this stage when no deployed site needs it.
FROM base AS chromium
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

FROM chromium AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM chromium AS release
COPY --from=install /usr/app/Thalia/node_modules ./node_modules
COPY . .

USER bun
EXPOSE 1337
CMD ["bun", "thalia"]
