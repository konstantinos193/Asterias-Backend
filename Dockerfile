# Shared base for both installs: node + pnpm + the manifest. Branching the two
# dependency stages off one base means pnpm is installed once, and BuildKit runs
# those stages in parallel instead of one after the other.
FROM node:20-slim AS base
WORKDIR /app

# Puppeteer talks to the distro chromium installed in the final stage, so no
# stage should ever download its own copy. SKIP_CHROMIUM_DOWNLOAD is the legacy
# name; puppeteer >= 20 reads SKIP_DOWNLOAD, and both are set so neither
# install script fetches ~180MB of Chrome for Testing.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml .npmrc ./


# Production dependency tree only. Independent of the compile, so it runs
# alongside the builder stage rather than after it.
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod


# Full dependency tree + TypeScript compile.
FROM base AS builder
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build


FROM node:20-slim AS production
WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 5000

CMD ["node", "dist/main.js"]
