FROM node:22-slim AS builder
  WORKDIR /repo

  RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY libs ./libs
  COPY apps/persist-member ./apps/persist-member

  RUN pnpm install --frozen-lockfile --filter "@kod-psm/persist-member..."
  RUN pnpm -r --filter "@kod-psm/persist-member..." run build

  # produce self-contained output
  RUN pnpm --filter "@kod-psm/persist-member" deploy --prod --legacy /out

  FROM node:22-slim AS runtime
  WORKDIR /app
  ENV NODE_ENV=production
  ENV PORT=8080
  EXPOSE 8080

  # run the deployed bundle
  COPY --from=builder /out ./

  CMD ["node", "dist/index.js"]
  