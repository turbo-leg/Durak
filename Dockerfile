# The one production image: Fly deploys it, and docker compose runs it locally.
# Node matches CI and local development.
FROM node:24-alpine

WORKDIR /app

# Copy manifest files first for better layer caching
COPY package*.json ./
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install all workspace dependencies (includes ts-node for server runtime)
RUN npm ci --no-audit --no-fund

# Copy source
COPY . .

# Build frontend assets that server will serve from packages/client/dist.
# The Discord application id is public; override it for another Discord app.
ARG VITE_DISCORD_CLIENT_ID=1493531312206647406
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID
RUN npm run build:client

ENV NODE_ENV=production
EXPOSE 2567

CMD ["npm", "run", "start:prod"]
