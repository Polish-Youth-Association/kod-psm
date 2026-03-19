FROM node:22-slim AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY libs ./libs
COPY apps/ai-chat ./apps/ai-chat

RUN pnpm install --frozen-lockfile --filter "@kod-psm/ai-chat..."
RUN pnpm -r --filter "@kod-psm/ai-chat..." run build
RUN pnpm --filter "@kod-psm/ai-chat" deploy --prod --legacy /out

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080

COPY --from=builder /out ./

CMD ["node", "dist/index.js"]
