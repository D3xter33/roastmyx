# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# RoastMyX production image
#
# Why this base image:
#   mcr.microsoft.com/playwright comes with Chromium + every system library
#   it needs (libgbm, libnss3, libdrm, fonts, etc) preinstalled. Saves us
#   ~300 lines of `apt-get install` and the headache of hunting library bugs
#   on a slim base.
#
# Build strategy:
#   - Stage 1 (deps):    install npm dependencies (cached layer)
#   - Stage 2 (builder): compile Next.js into a standalone bundle
#   - Stage 3 (runner):  copy only the built output + node_modules and run
# ---------------------------------------------------------------------------

# Must match the `playwright` version in package.json exactly — Playwright
# pairs the npm package with a specific Chromium build. If they don't match,
# you get "Executable doesn't exist at /ms-playwright/...".
ARG PLAYWRIGHT_VERSION=v1.59.1-noble

# ---------- deps ----------
FROM mcr.microsoft.com/playwright:${PLAYWRIGHT_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Avoid running playwright install — Chromium is already in the base image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --no-audit --no-fund

# ---------- builder ----------
FROM mcr.microsoft.com/playwright:${PLAYWRIGHT_VERSION} AS builder
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
FROM mcr.microsoft.com/playwright:${PLAYWRIGHT_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js standalone server defaults to HOSTNAME=localhost, which only binds
# to loopback. Railway (and any external proxy) can't reach the container
# unless we listen on 0.0.0.0. This is the one-line fix for the classic
# "502 Application failed to respond" symptom on Railway / Fly / Cloud Run.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Tell Playwright to use the system-installed Chromium from the base image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Drop privileges. The Microsoft Playwright image ships a non-root `pwuser`.
# Copy the standalone Next.js bundle (output: 'standalone' → minimal runtime).
COPY --from=builder --chown=pwuser:pwuser /app/.next/standalone ./
COPY --from=builder --chown=pwuser:pwuser /app/.next/static ./.next/static
# /public copied only if present — RoastMyX serves all images via the
# Playwright proxy or remote URLs, so no static assets ship.
# Playwright lives outside the standalone bundle (it's a server-external pkg)
# so we have to copy node_modules/playwright explicitly.
COPY --from=builder --chown=pwuser:pwuser /app/node_modules/playwright ./node_modules/playwright
COPY --from=builder --chown=pwuser:pwuser /app/node_modules/playwright-core ./node_modules/playwright-core

USER pwuser
EXPOSE 3000
CMD ["node", "server.js"]
