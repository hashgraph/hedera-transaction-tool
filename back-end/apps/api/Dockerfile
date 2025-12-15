FROM node:22-alpine AS development

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY scripts/postinstall.sh scripts/postinstall.sh
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY apps/api/package.json apps/api/package.json
COPY apps/api/tsconfig.app.json apps/api/tsconfig.app.json

ENV SKIP_NOTICE_GEN=true

RUN pnpm install && cd apps/api && pnpm install

COPY libs libs
COPY apps/api apps/api
COPY typeorm typeorm

RUN pnpm run build api

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY scripts/postinstall.sh scripts/postinstall.sh

RUN npm install -g pnpm

ENV SKIP_NOTICE_GEN=true

RUN pnpm install

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/typeorm ./typeorm
COPY --from=development /usr/src/app/libs ./libs
COPY --from=development /usr/src/app/tsconfig.json ./tsconfig.json

CMD ["node", "dist/apps/api/main"]