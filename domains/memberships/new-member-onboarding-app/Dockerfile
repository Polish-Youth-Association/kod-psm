# Multi-stage build using pnpm + workspaces

FROM node:22-slim AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy root workspace metadata
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all workspace packages (you can add services/* if you want them too)
COPY domains ./domains
COPY packages ./packages
COPY services ./services

# Install deps for the whole monorepo (honors pnpm-lock.yaml)
RUN pnpm install --frozen-lockfile

# Build ONLY this app (not the entire monorepo)
RUN pnpm --filter @kod-psm/new-member-onboarding-app run build

# -----------------------------
# Runtime image
# -----------------------------
FROM node:22-slim AS runtime

WORKDIR /app

# Enable corepack/pnpm here only if you really need pnpm at runtime (usually you don't)
# For runtime we just need node_modules for this app + its built JS.

# Copy node_modules and built code from builder
# (this copies entire node_modules + monorepo; simplest for now, can optimize later)
COPY --from=builder /app /app

# Cloud Run will inject PORT env var; default to 8080
ENV PORT=8080

EXPOSE 8080

# Start the app
CMD ["node", "domains/memberships/new-member-onboarding-app/dist/index.js"]