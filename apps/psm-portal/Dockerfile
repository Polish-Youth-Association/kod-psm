FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs ./libs
COPY apps/psm-portal ./apps/psm-portal

RUN pnpm install --frozen-lockfile --filter "@kod-psm/psm-portal..."
RUN pnpm --filter "@kod-psm/psm-portal" run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy standalone server bundle (contains server.js + minimal node_modules)
COPY --from=builder /repo/apps/psm-portal/.next/standalone ./

# Copy static assets and public
COPY --from=builder /repo/apps/psm-portal/.next/static ./.next/static
COPY --from=builder /repo/apps/psm-portal/public ./public

CMD ["node", "apps/psm-portal/server.js"]