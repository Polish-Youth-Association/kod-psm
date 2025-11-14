FROM node:22-slim

WORKDIR /app

# Copy monorepo files
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY domains ./domains
COPY packages ./packages

RUN corepack enable \
  && corepack prepare pnpm@10.22.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @kod-psm/new-member-onboarding-app build

# Only copy the built app if you want a slimmer image, or just leave as-is
WORKDIR /app/domains/memberships/new-member-onboarding-app
ENV PORT=8080
CMD ["node", "dist/index.js"]