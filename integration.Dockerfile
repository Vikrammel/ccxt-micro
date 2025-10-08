FROM node:24.8.0-alpine

# protoc for ts-proto generation
RUN apk add --no-cache protobuf-dev

# Yarn via Corepack
RUN corepack enable && corepack prepare yarn@1.22.19 --activate

WORKDIR /app

# 1) install deps WITHOUT running scripts (so we don't need protoc yet)
COPY package.json yarn.lock ./
RUN yarn install --ignore-scripts

# 2) bring in project files
COPY tsconfig.json ./
COPY proto ./proto
COPY src ./src

# 3) now generate the code (protoc is available)
RUN yarn proto:gen

# 4) bring tests + jest config
COPY itest ./itest
COPY jest.integration.config.ts ./

CMD ["yarn", "test:integration", "--runInBand"]
