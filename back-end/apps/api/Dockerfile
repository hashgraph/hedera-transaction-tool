FROM node:22-alpine@sha256:8f6be98e48e57c0ebad20c67b16377a96491ef6d10a8a77b6def82ced1c1c287 AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json

COPY apps/api apps/api
COPY libs libs

RUN npm install -g pnpm

RUN pnpm install && cd apps/api && pnpm install

RUN pnpm run build api

FROM node:22-alpine@sha256:8f6be98e48e57c0ebad20c67b16377a96491ef6d10a8a77b6def82ced1c1c287 AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./

RUN npm install -g pnpm

RUN pnpm install --prod

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/api/main"]