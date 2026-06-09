FROM node:24.15.0-alpine AS base

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm@9.15.3

FROM base AS development

# Root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# All workspace package manifests so pnpm-workspace.yaml + lockfile resolve.
# Only manifests (and the tsconfig needed to build) are copied here so the
# install layer below is cached on dependency changes only.
COPY front-end/package.json ./front-end/
COPY automation/package.json ./automation/
COPY back-end/package.json back-end/tsconfig.json back-end/nest-cli.json ./back-end/
COPY back-end/typeorm/package.json ./back-end/typeorm/
COPY back-end/apps/api/package.json ./back-end/apps/api/
COPY back-end/apps/chain/package.json back-end/apps/chain/tsconfig.app.json ./back-end/apps/chain/
COPY back-end/apps/notifications/package.json ./back-end/apps/notifications/

ENV SKIP_NOTICE_GEN=true

# Cache the pnpm content-addressable store across builds. The shared id means
# every image/stage reuses the same store on the persistent (self-hosted)
# builder, so packages are fetched once.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --filter "back-end..." --filter "@back-end/chain..." --frozen-lockfile

COPY back-end/libs ./back-end/libs
COPY back-end/apps/chain ./back-end/apps/chain

WORKDIR /usr/src/app/back-end
RUN pnpm build:chain

FROM base AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

COPY front-end/package.json ./front-end/
COPY automation/package.json ./automation/
COPY back-end/package.json ./back-end/
COPY back-end/typeorm/package.json ./back-end/typeorm/
COPY back-end/apps/api/package.json ./back-end/apps/api/
COPY back-end/apps/chain/package.json ./back-end/apps/chain/
COPY back-end/apps/notifications/package.json ./back-end/apps/notifications/

ENV SKIP_NOTICE_GEN=true

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --filter "back-end..." --filter "@back-end/chain..." --prod --frozen-lockfile

# Runtime-only files copied after install so they never bust the install layer.
COPY back-end/scripts ./back-end/scripts
COPY --from=development /usr/src/app/back-end/dist ./back-end/dist

WORKDIR /usr/src/app/back-end
CMD ["node", "dist/apps/chain/main"]
