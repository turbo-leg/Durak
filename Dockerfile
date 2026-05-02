FROM node:20-alpine

WORKDIR /app

# Copy manifest files first for better layer caching
COPY package*.json ./
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install all workspace dependencies (includes ts-node for server runtime)
RUN npm ci

# Copy source
COPY . .

# Build frontend and backend assets
RUN npm run build:client && npm run build:server

ENV NODE_ENV=production
EXPOSE 2567

CMD ["npm", "run", "start:prod"]
