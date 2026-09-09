# ResumeForge — fully self-contained images (no hosted services required).
#   docker build -t resumeforge .                    (web, standalone)
#   docker build -t resumeforge-full --target full . (migrations + worker)
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ── web runner: Next standalone output (small, no dev tooling) ─────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# ── full runner: same deps + source, used for `prisma migrate deploy` and
#    the queue worker (needs the app's TS entrypoints via tsx, kept in devDep)
FROM node:22-slim AS full
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json /app/package-lock.json /app/prisma.config.ts /app/tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/next.config.ts ./
CMD ["node", "node_modules/.bin/prisma", "migrate", "deploy"]
