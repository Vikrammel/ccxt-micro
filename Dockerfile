# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY proto ./proto
COPY src ./src

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=50051

COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY proto ./proto

EXPOSE 50051

CMD ["node", "dist/index.js"]
