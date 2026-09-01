# syntax=docker/dockerfile:1.6
# Multi-stage production build for Mandovara Interior OS.
#
# Coolify picks this up automatically when the app's build pack is set
# to "Dockerfile". Three stages keep the final image small (~180 MB):
#
#   deps    — install prod + dev dependencies (needed to build)
#   build   — prisma generate + next build (produces .next/standalone)
#   runtime — copy just the standalone output + minimal Prisma runtime
#
# The runtime entrypoint runs `prisma migrate deploy` before starting
# the server so every deploy is schema-current with zero manual steps.
#
# BuildKit cache mounts (--mount=type=cache) on `pnpm install` and
# `next build` reuse the pnpm store and Next's incremental compile
# cache across deploys. Requires BuildKit (default on Coolify + modern
# Docker); with it, subsequent builds skip 60-70% of the deps + compile
# work when only app source changed.

# ─── Stage 1: dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat is needed by Prisma's query engine on Alpine.
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile


# ─── Stage 2: build ─────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10 --activate

# Give Node a 4 GB heap for `next build` (tsc + Turbopack together OOM
# on the default 1.5 GB heap on modest VPS builds — Coolify build was
# failing with exit code 255 during "Running TypeScript"). Applied only
# to this stage; runtime doesn't need the extra allocation.
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client is generated against the schema; must run before
# `next build` because our code imports @prisma/client.
# Run `next build` directly (not via `pnpm build`) to skip the
# `postbuild: prisma migrate deploy` npm hook — migrations require a live
# database and belong at container start (docker-entrypoint.sh), not here.
#
# `.next/cache` mount reuses Next's incremental compile artefacts across
# deploys, so unchanged pages/routes don't get retypechecked and rebundled.
# Empty cache on first run — populated after the first successful build.
RUN pnpm prisma generate
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm exec next build


# ─── Stage 3: runtime ───────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Same libc + a non-root user for the container process.
RUN apk add --no-cache libc6-compat openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output = server.js + Prisma client + everything Next
# traced as reachable. next.config.ts `outputFileTracingIncludes`
# forces the Prisma client + schema in so we don't need to hunt
# for pnpm-hash paths ourselves.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public           ./public

# The Prisma CLI needs its own binary to run `migrate deploy` at
# container start. Install it into an isolated sibling dir so it
# doesn't collide with the pnpm-structured node_modules that came
# out of the standalone build. tsx joins it so the entrypoint can
# run prisma/seed.ts (TypeScript) directly on an empty DB.
RUN --mount=type=cache,id=npm-prisma-cli,target=/root/.npm \
    mkdir -p /opt/prisma-cli \
 && cd /opt/prisma-cli \
 && npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund prisma@6.19.0 tsx@4 \
 && ln -s /opt/prisma-cli/node_modules/.bin/tsx /usr/local/bin/tsx \
 && chown -R nextjs:nodejs /opt/prisma-cli

COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --chown=nextjs:nodejs scripts/check-empty.mjs         /app/check-empty.mjs
COPY --chown=nextjs:nodejs scripts/wipe-demo-data.mjs      /app/scripts/wipe-demo-data.mjs

# The "am I about to destroy real data?" guard. REQUIRED, not optional:
# wipe-demo-data.mjs and prisma/seed.ts both import it, and seed.ts runs
# from the entrypoint whenever the database looks empty. Without this file
# that import throws and the seed dies at startup.
COPY --chown=nextjs:nodejs scripts/lib/db-target.mjs       /app/scripts/lib/db-target.mjs

# Diagnostic, safe to run any time — finds rows whose required parent is
# missing or in another org, which crash a page instead of degrading it.
#   node /app/scripts/find-broken-relations.mjs
COPY --chown=nextjs:nodejs scripts/find-broken-relations.mjs /app/scripts/find-broken-relations.mjs
COPY --chown=nextjs:nodejs scripts/find-cross-org-clients.mjs /app/scripts/find-cross-org-clients.mjs

# §3.2 Row-Level Security. Both are invoked by docker-entrypoint.sh on every
# boot, so they MUST be in the image — without them the entrypoint aborts.
#   setup-app-role       creates/rotates the restricted mandovara_app role
#   check-auth-bootstrap refuses to serve if login would be impossible under RLS
COPY --chown=nextjs:nodejs scripts/setup-app-role.mjs      /app/scripts/setup-app-role.mjs
COPY --chown=nextjs:nodejs scripts/check-auth-bootstrap.mjs /app/scripts/check-auth-bootstrap.mjs
COPY --chown=nextjs:nodejs scripts/pre-migrate.mjs          /app/scripts/pre-migrate.mjs

# One-shot catalog reset — wipes brand/collection/design/colourway and
# reloads Rugway + Fedora with real swatch images copied onto the
# mounted /app/public/catalog volume. Baked in with its source-image
# folders so it can run entirely inside the container.
# Gate: CONFIRM_WIPE=I_UNDERSTAND must be set — see script header.
COPY --chown=nextjs:nodejs scripts/prod-reset-catalog.mjs  /app/scripts/prod-reset-catalog.mjs
COPY --chown=nextjs:nodejs scripts/attach-rugway-pdf.mjs   /app/scripts/attach-rugway-pdf.mjs
COPY --chown=nextjs:nodejs scripts/fedora-swatches         /app/scripts/fedora-swatches
COPY --chown=nextjs:nodejs scripts/rugway-crops            /app/scripts/rugway-crops

RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Let the container report its own health.
#
# Without this Docker computes no health status, so Coolify shows
# "Running (no healthcheck)" — an amber dot that means "I cannot tell",
# not "something is wrong". Declaring it here makes the image correct
# wherever it runs, with no dashboard configuration to remember.
#
# --start-period is deliberately long. docker-entrypoint.sh regenerates
# the Prisma client, applies migrations, provisions the RLS role and
# verifies the auth bootstrap BEFORE the server accepts a connection;
# on a deploy carrying migrations that is comfortably a minute. A short
# start period marks a perfectly good release unhealthy while it is
# still migrating, and anything gating on health may then roll it back.
# Docker ends the start period early on the first success, so being
# generous costs nothing.
#
# busybox wget, because the image has no curl. --spider exits 0 only on
# 2xx: 404, 500 and 503 all exit 1, so an app that is up but broken
# fails the check rather than passing it.
HEALTHCHECK --interval=15s --timeout=10s --start-period=180s --retries=5 \
  CMD wget --quiet --spider -T 5 "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

# Entrypoint: apply pending migrations, seed if DB is empty, start Next.
# All three steps idempotent — safe on every container start.
CMD ["/app/docker-entrypoint.sh"]
