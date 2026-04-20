FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/is-domain/package.json packages/is-domain/package-lock.json ./packages/is-domain/
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/

COPY packages/is-domain ./packages/is-domain
COPY apps/api ./apps/api

RUN cd /app/packages/is-domain && npm ci
RUN cd /app/packages/is-domain && npm run build

# postinstall runs `prisma generate`; prisma.config.ts requires DATABASE_URL (no real DB connection for generate)
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/is_crm

RUN cd /app/apps/api && npm ci
RUN cd /app/apps/api && npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/is-domain ./packages/is-domain
COPY --from=build /app/packages/is-domain/node_modules ./packages/is-domain/node_modules

COPY apps/api/docker/entrypoint.sh /usr/local/bin/is01-api-entrypoint
RUN chmod +x /usr/local/bin/is01-api-entrypoint

EXPOSE 3001

ENTRYPOINT ["/usr/local/bin/is01-api-entrypoint"]
