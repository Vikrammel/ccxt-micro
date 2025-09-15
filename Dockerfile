# ---------- Build stage ----------
FROM node:24.8.0-alpine AS build

# Needed for protoc & any native deps (build-only)
RUN apk add --no-cache python3 make g++ protobuf-dev

# Use Yarn via Corepack (no global npm install)
RUN corepack enable && corepack prepare yarn@1.22.19 --activate

WORKDIR /app

# Install deps first for caching
COPY package.json yarn.lock ./
# Skip scripts so postinstall (e.g., proto:gen) doesn't run yet
RUN yarn install --frozen-lockfile --ignore-scripts

# Project files
COPY tsconfig.json ./
COPY proto ./proto
COPY src ./src

# Re-generate protobuf TS and build
RUN rm -rf src/generated/
RUN yarn proto:gen
RUN yarn build

# ---------- Runtime stage ----------
FROM node:24.8.0-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=50051

# Corepack is included with Node; just enable it (no global yarn install)
RUN corepack enable

# Install only production deps (again, no scripts)
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile --ignore-scripts

# Copy compiled output
COPY --from=build /app/dist ./dist
# (proto files not needed at runtime, omit unless you want them)
# COPY proto ./proto

EXPOSE 50051
CMD ["node", "dist/index.js"]
