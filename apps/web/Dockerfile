FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/is-domain/package.json packages/is-domain/package-lock.json ./packages/is-domain/
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/

COPY packages/is-domain ./packages/is-domain
COPY apps/web ./apps/web

RUN cd /app/packages/is-domain && npm ci
RUN cd /app/packages/is-domain && npm run build

ENV NEXT_DIST_DIR=.next-build

RUN cd /app/apps/web && npm ci
RUN cd /app/apps/web && npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_DIST_DIR=.next-build
ENV PORT=3000

COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /app/packages/is-domain ./packages/is-domain
COPY --from=build /app/packages/is-domain/node_modules ./packages/is-domain/node_modules

EXPOSE 3000

# Bind explicitly for Docker port publishing (avoid localhost-only listen).
CMD ["npm", "--prefix", "apps/web", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
