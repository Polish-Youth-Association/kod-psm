FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# workspace + root TS configs (needed because libs/* tsconfig extends them)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# code
COPY libs ./libs
COPY apps/example2 ./apps/example2

# install deps needed for this slice of the monorepo
RUN pnpm install --frozen-lockfile --filter "@kod-psm/example2..."

# build service + its deps (http-helpers)
RUN pnpm -r --filter "@kod-psm/example2..." run build

# produce a self-contained production output
RUN pnpm --filter "@kod-psm/example2" deploy --prod --legacy /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY --from=builder /out ./

CMD ["node", "dist/index.js"]