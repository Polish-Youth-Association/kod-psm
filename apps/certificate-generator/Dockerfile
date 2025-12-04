FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

COPY package.json ./

COPY templates ./templates
COPY src ./src

RUN pnpm install

COPY . .

RUN pnpm run build

FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=builder /app /app

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
