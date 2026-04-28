FROM node:20-alpine

WORKDIR /usr/src/app

# Copy root package.json and lockfile
COPY package*.json ./

# Copy packages package.json files so npm ci can resolve all workspaces
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
COPY packages/shared/package.json ./packages/shared/

# Install all workspace dependencies, including client build tooling
RUN npm ci

# Copy the rest of the monorepo code
COPY . .

# Build the client so the server can serve the production UI from /packages/client/dist
RUN npm run build:client

# Expose colyseus port
EXPOSE 2567

WORKDIR /usr/src/app/packages/server

CMD ["npm", "start"]
