FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

FROM dependencies AS builder

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && rm -rf node_modules/prisma node_modules/typescript \
    && rm -f node_modules/.bin/prisma node_modules/.bin/tsc node_modules/.bin/tsserver

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime-base

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache su-exec
COPY docker-entrypoint.sh /usr/local/bin/sweettoon-entrypoint
RUN chmod +x /usr/local/bin/sweettoon-entrypoint \
    && mkdir -p /app/data/uploads \
    && chown -R node:node /app/data

ENTRYPOINT ["sweettoon-entrypoint"]

FROM runtime-base AS migrate

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma

CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed"]

FROM runtime-base AS runner

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/dist ./dist
COPY package.json package-lock.json ./

EXPOSE 4000

CMD ["node", "dist/index.js"]
