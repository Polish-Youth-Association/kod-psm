FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

COPY package.json .yaml ./

RUN pnpm install

COPY . .

RUN pnpm run build

FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=builder /app /app

ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/example/dist/index.js"]
