FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# copy only what we need for this build (preserves folder structure)
COPY libs ./libs
COPY apps/example ./apps/example

# If you have shared root configs, copy them too (uncomment if they exist)
# COPY tsconfig.base.json ./
# COPY .npmrc ./

RUN pnpm install --frozen-lockfile --filter ./apps/example...

RUN pnpm -C apps/example run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY --from=builder /repo/apps/example/dist ./dist
COPY --from=builder /repo/apps/example/package.json ./
COPY --from=builder /repo/node_modules ./node_modules

CMD ["node", "dist/index.js"]