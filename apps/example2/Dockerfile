FROM node:22-slim AS builder
  WORKDIR /repo

  RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY libs ./libs
  COPY apps/example2 ./apps/example2

  RUN pnpm install --frozen-lockfile --filter "@kod-psm/example2..."
  RUN pnpm -r --filter "@kod-psm/example2..." run build

  # produce self-contained output
  RUN pnpm --filter "@kod-psm/example2" deploy --prod --legacy /out

  FROM node:22-slim AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PORT=8080
  EXPOSE 8080

  # run the deployed bundle
  COPY --from=builder /out ./

  CMD ["node", "dist/index.js"]
  