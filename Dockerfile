# Root Dockerfile building the new-member-onboarding-app using pnpm workspaces

FROM node:22-slim AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy workspace metadata
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy monorepo source
COPY domains ./domains
COPY packages ./packages
COPY services ./services

# Install deps for the whole monorepo
RUN pnpm install --frozen-lockfile

# Option A: build only what we need
RUN pnpm --filter @kod-psm/email-templates run build \
 && pnpm --filter @kod-psm/new-member-onboarding-app run build

# -----------------------------
# Runtime image
# -----------------------------
FROM node:22-slim AS runtime

WORKDIR /app

# Copy everything from builder
COPY --from=builder /app /app

ENV PORT=8080
EXPOSE 8080

CMD ["node", "domains/memberships/new-member-onboarding-app/dist/index.js"]