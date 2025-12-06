FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

COPY apps ./apps
COPY libs ./libs

RUN pnpm install --filter @kod-psm/certificate-generator...

RUN pnpm --filter @kod-psm/gcp-helpers run build

RUN pnpm --filter @kod-psm/certificate-generator run build

FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=builder /repo/apps/certificate-generator/dist ./dist

COPY --from=builder /repo/apps/certificate-generator/templates ./templates

COPY --from=builder /repo/apps/certificate-generator/package.json ./package.json

COPY --from=builder /repo/node_modules ./node_modules

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]