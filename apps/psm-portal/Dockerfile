FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy only the workspace metadata first (better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs ./libs
COPY apps/psm-portal ./apps/psm-portal

# Install only what portal needs (and its workspace deps)
RUN pnpm install --frozen-lockfile --filter "@kod-psm/psm-portal..."

# Build the portal
RUN pnpm --filter "@kod-psm/psm-portal" run build

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy standalone output
COPY --from=builder /repo/apps/psm-portal/.next/standalone ./
# Copy static assets
COPY --from=builder /repo/apps/psm-portal/.next/static ./.next/static
# Copy public folder if you use it
COPY --from=builder /repo/apps/psm-portal/public ./public

CMD ["node", "server.js"]