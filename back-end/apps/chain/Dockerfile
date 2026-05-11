FROM node:22.12.0-alpine AS development

WORKDIR /usr/src/app

RUN npm install -g pnpm

# Root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# All workspace package manifests so pnpm-workspace.yaml + lockfile resolve
COPY front-end/package.json ./front-end/
COPY automation/package.json ./automation/
COPY back-end/package.json back-end/tsconfig.json back-end/nest-cli.json ./back-end/
COPY back-end/scripts ./back-end/scripts
COPY back-end/typeorm/package.json ./back-end/typeorm/
COPY back-end/apps/api/package.json ./back-end/apps/api/
COPY back-end/apps/chain/package.json back-end/apps/chain/tsconfig.app.json ./back-end/apps/chain/
COPY back-end/apps/notifications/package.json ./back-end/apps/notifications/

ENV SKIP_NOTICE_GEN=true

RUN pnpm install --filter "back-end..." --filter "@back-end/chain..." --frozen-lockfile

COPY back-end/libs ./back-end/libs
COPY back-end/apps/chain ./back-end/apps/chain

WORKDIR /usr/src/app/back-end
RUN pnpm build:chain

FROM node:22.12.0-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

RUN npm install -g pnpm

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

RUN pnpm install --filter "back-end..." --filter "@back-end/chain..." --prod --frozen-lockfile

COPY --from=development /usr/src/app/back-end/dist ./back-end/dist

WORKDIR /usr/src/app/back-end
CMD ["node", "dist/apps/chain/main"]
