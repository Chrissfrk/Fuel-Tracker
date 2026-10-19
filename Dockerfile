# syntax=docker/dockerfile:1.7

# ---- 1. Build: install everything, build shared → web → server ----------------
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY . .
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
RUN npm run build

# ---- 2. Production dependencies for the server only, native modules rebuilt for this image ----
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @fuel/server --no-audit --no-fund \
    && npm rebuild better-sqlite3 argon2

# ---- 3. Runtime: slim image, non-root, one port --------------------------------
FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    TZ=Europe/Athens
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/index.js"]
