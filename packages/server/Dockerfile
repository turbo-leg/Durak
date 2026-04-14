FROM node:22-alpine

WORKDIR /usr/src/app

# Copy root package.json and lockfile
COPY package*.json ./

# Copy packages package.json files so npm install can resolve workspaces
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (workspaces requires this to run at root)
RUN npm ci

# Copy the rest of the monorepo code
COPY . .

# Expose colyseus port
EXPOSE 2567

WORKDIR /usr/src/app/packages/server

CMD ["npm", "start"]
