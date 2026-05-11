FROM node:24.15.0-alpine AS development

WORKDIR /usr/src/app

RUN npm install -g pnpm@9.15.3

# Root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# All workspace package manifests so pnpm-workspace.yaml + lockfile resolve
COPY front-end/package.json ./front-end/
COPY automation/package.json ./automation/
COPY back-end/package.json back-end/tsconfig.json back-end/nest-cli.json ./back-end/
COPY back-end/scripts ./back-end/scripts
COPY back-end/typeorm/package.json ./back-end/typeorm/
COPY back-end/apps/api/package.json ./back-end/apps/api/
COPY back-end/apps/chain/package.json ./back-end/apps/chain/
COPY back-end/apps/notifications/package.json back-end/apps/notifications/tsconfig.app.json ./back-end/apps/notifications/

ENV SKIP_NOTICE_GEN=true

RUN pnpm install --filter "back-end..." --filter "@back-end/notifications..." --frozen-lockfile

COPY back-end/libs ./back-end/libs
COPY back-end/apps/notifications ./back-end/apps/notifications

WORKDIR /usr/src/app/back-end
RUN pnpm build:notifications

FROM node:24.15.0-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

RUN npm install -g pnpm@9.15.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

COPY front-end/package.json ./front-end/
COPY automation/package.json ./automation/
COPY back-end/package.json ./back-end/
COPY back-end/scripts ./back-end/scripts
COPY back-end/typeorm/package.json ./back-end/typeorm/
COPY back-end/apps/api/package.json ./back-end/apps/api/
COPY back-end/apps/chain/package.json ./back-end/apps/chain/
COPY back-end/apps/notifications/package.json ./back-end/apps/notifications/

ENV SKIP_NOTICE_GEN=true

RUN pnpm install --filter "back-end..." --filter "@back-end/notifications..." --prod --frozen-lockfile

COPY --from=development /usr/src/app/back-end/dist ./back-end/dist

WORKDIR /usr/src/app/back-end
CMD ["node", "dist/apps/notifications/main"]
