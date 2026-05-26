FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies first (layer caching)
COPY package*.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# Copy source and build everything
COPY . .
RUN npm run build:client
RUN cd packages/server && npx tsc --noEmit false --outDir dist

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /usr/src/app

# Only production deps
COPY package*.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev

# Copy compiled server, built client, and shared source (needed at runtime for @durak/shared)
COPY --from=builder /usr/src/app/packages/server/dist ./packages/server/dist
COPY --from=builder /usr/src/app/packages/client/dist ./packages/client/dist
COPY --from=builder /usr/src/app/packages/shared ./packages/shared

EXPOSE 2567

WORKDIR /usr/src/app/packages/server

CMD ["node", "dist/index.js"]
