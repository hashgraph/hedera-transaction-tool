FROM node:22.12.0-alpine AS builder

WORKDIR /usr/src/app

RUN npm install -g pnpm

# Root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Workspace package manifests
COPY front-end/package.json ./front-end/
COPY automation/package.json ./automation/
COPY back-end/package.json back-end/tsconfig.json back-end/nest-cli.json ./back-end/
COPY back-end/scripts ./back-end/scripts
COPY back-end/typeorm/package.json ./back-end/typeorm/
COPY back-end/apps/api/package.json ./back-end/apps/api/
COPY back-end/apps/chain/package.json ./back-end/apps/chain/
COPY back-end/apps/notifications/package.json ./back-end/apps/notifications/

ENV SKIP_NOTICE_GEN=true

RUN pnpm install --filter "back-end..." --filter "typeorm..." --frozen-lockfile --ignore-scripts

# Copy source for libs (entities) and typeorm
COPY back-end/libs ./back-end/libs
COPY back-end/typeorm ./back-end/typeorm

WORKDIR /usr/src/app/back-end
RUN pnpm build:common && pnpm build:migrations

FROM node:22.12.0-alpine

WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN npm install -g pnpm

COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /usr/src/app/.npmrc ./.npmrc

COPY --from=builder /usr/src/app/front-end/package.json ./front-end/package.json
COPY --from=builder /usr/src/app/automation/package.json ./automation/package.json
COPY --from=builder /usr/src/app/back-end/package.json ./back-end/package.json
COPY --from=builder /usr/src/app/back-end/scripts ./back-end/scripts
COPY --from=builder /usr/src/app/back-end/typeorm/package.json ./back-end/typeorm/package.json
COPY --from=builder /usr/src/app/back-end/apps/api/package.json ./back-end/apps/api/package.json
COPY --from=builder /usr/src/app/back-end/apps/chain/package.json ./back-end/apps/chain/package.json
COPY --from=builder /usr/src/app/back-end/apps/notifications/package.json ./back-end/apps/notifications/package.json

ENV CI=true
ENV SKIP_NOTICE_GEN=true

RUN pnpm install --prod --filter "back-end..." --filter "typeorm..." --frozen-lockfile --ignore-scripts

# Copy compiled migrations + libs
COPY --from=builder /usr/src/app/back-end/dist/typeorm ./back-end/dist/typeorm
COPY --from=builder /usr/src/app/back-end/dist/libs ./back-end/dist/libs

WORKDIR /usr/src/app/back-end
CMD ["pnpm", "-F", "typeorm", "migration:run"]
