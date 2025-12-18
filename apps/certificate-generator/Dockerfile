FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# copy only what we need for this build (preserves folder structure)
COPY libs ./libs
COPY apps/certificate-generator ./apps/certificate-generator

# If you have shared root configs, copy them too (uncomment if they exist)
# COPY tsconfig.base.json ./
# COPY .npmrc ./

RUN pnpm install --frozen-lockfile --filter "@kod-psm/certificate-generator..."
RUN pnpm -r --filter "@kod-psm/certificate-generator..." run build
RUN pnpm --filter "@kod-psm/certificate-generator" deploy --prod --legacy /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY --from=builder /repo/apps/certificate-generator/dist ./dist
COPY --from=builder /repo/apps/certificate-generator/package.json ./
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/libs ./libs

CMD ["node", "dist/index.js"]