FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# ---- copy workspace manifests first (cache-friendly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# copy package manifests so pnpm can resolve workspace deps
COPY libs/*/package.json ./libs/
COPY apps/certificate-generator/package.json ./apps/certificate-generator/

# install only this app + its deps (including libs/* workspace packages)
RUN pnpm install --frozen-lockfile --filter ./apps/certificate-generator...

# now copy the full repo sources
COPY . .

# build just this app (and any libs it depends on if your scripts are correct)
RUN pnpm -r --filter ./apps/certificate-generator... run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# copy only what we need for runtime
COPY --from=builder /repo/apps/certificate-generator/dist ./dist
COPY --from=builder /repo/apps/certificate-generator/package.json ./
COPY --from=builder /repo/node_modules ./node_modules

CMD ["node", "dist/index.js"]