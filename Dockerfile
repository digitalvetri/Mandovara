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

# ─── Stage 1: dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat is needed by Prisma's query engine on Alpine.
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile


# ─── Stage 2: build ─────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client is generated against the schema; must run before
# `next build` because our code imports @prisma/client.
RUN pnpm prisma generate
RUN pnpm build


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

# Next's tracer misses the generated Prisma client dir (.prisma/) on
# pnpm layouts, even with outputFileTracingIncludes — so any
# `require('@prisma/client')` throws "Cannot find module
# '.prisma/client/default'". Fix by installing a clean @prisma/client
# into /app/node_modules ourselves and generating the client against
# our schema, overwriting whatever the standalone tracer left behind.

# The Prisma CLI needs its own binary to run `migrate deploy` at
# container start. Install it into an isolated sibling dir so it
# doesn't collide with the pnpm-structured node_modules that came
# out of the standalone build. tsx joins it so the entrypoint can
# run prisma/seed.ts (TypeScript) directly on an empty DB.
RUN mkdir -p /opt/prisma-cli \
 && cd /opt/prisma-cli \
 && npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund prisma@6.19.0 tsx@4 \
 && ln -s /opt/prisma-cli/node_modules/.bin/tsx /usr/local/bin/tsx \
 && chown -R nextjs:nodejs /opt/prisma-cli

# Install @prisma/client into the app's node_modules (no-save so we
# don't disturb the standalone package.json) and run `prisma generate`
# so /app/node_modules/.prisma/client/default.js exists at runtime.
RUN cd /app \
 && npm install --no-save --omit=dev --no-audit --no-fund @prisma/client@6.19.0 \
 && /opt/prisma-cli/node_modules/.bin/prisma generate --schema=/app/prisma/schema.prisma \
 && chown -R nextjs:nodejs /app/node_modules/.prisma /app/node_modules/@prisma

COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --chown=nextjs:nodejs scripts/check-empty.mjs /app/check-empty.mjs
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Entrypoint: apply pending migrations, seed if DB is empty, start Next.
# All three steps idempotent — safe on every container start.
CMD ["/app/docker-entrypoint.sh"]
