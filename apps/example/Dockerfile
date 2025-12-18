FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy only workspace manifests first (better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs/*/package.json ./libs/
COPY apps/my-app/package.json ./apps/my-app/

# Install only what my-app needs (includes its workspace deps under libs/)
RUN pnpm install --frozen-lockfile --filter ./apps/example

# Now copy full source
COPY . .

# Build the app (and any deps if your build script is recursive)
RUN pnpm -r --filter ./apps/example run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy only what you need (better than copying the whole repo)
COPY --from=builder /repo/apps/my-app/dist ./dist
COPY --from=builder /repo/apps/my-app/package.json ./
COPY --from=builder /repo/node_modules ./node_modules

CMD ["node", "dist/index.js"]