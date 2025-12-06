# ---------- BUILDER ----------
FROM node:22-slim AS builder
WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Copy monorepo metadata
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy all workspace packages (apps + libs)
COPY apps ./apps
COPY libs ./libs

# Install deps for the whole workspace
RUN pnpm install --frozen-lockfile

# Build shared libs first (so types & dist exist)
RUN pnpm --filter @kod-psm/gcp-helpers run build

# Build the certificate-generator app
RUN pnpm --filter @kod-psm/certificate-generator run build

# ---------- RUNTIME ----------
FROM node:22-slim AS runtime
WORKDIR /app

# Copy only what we need to run the app
COPY --from=builder /app/apps/certificate-generator/dist ./dist
COPY --from=builder /app/apps/certificate-generator/templates ./templates
COPY --from=builder /app/apps/certificate-generator/package.json ./package.json

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate \
    && pnpm install --prod

# Cloud Run runtime
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]