FROM node:22-alpine AS development

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY scripts/postinstall.sh scripts/postinstall.sh
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY apps/notifications/package.json apps/notifications/package.json
COPY apps/notifications/tsconfig.app.json apps/notifications/tsconfig.app.json

ENV SKIP_NOTICE_GEN=true

RUN pnpm install && cd apps/notifications && pnpm install

COPY libs libs
COPY apps/notifications apps/notifications

RUN pnpm run build notifications

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY scripts/postinstall.sh scripts/postinstall.sh

RUN npm install -g pnpm

ENV SKIP_NOTICE_GEN=true

RUN pnpm install --prod

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/notifications/main"]