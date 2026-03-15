FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/

RUN corepack enable && pnpm install --frozen-lockfile --filter @speculo/api...

COPY packages/api/ packages/api/
RUN pnpm --filter @speculo/api build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/src/db/migrations ./src/db/migrations

EXPOSE 3000

CMD ["node", "dist/server.js"]
