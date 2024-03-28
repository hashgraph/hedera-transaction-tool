FROM node:alpine AS development

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install

COPY apps/api apps/api
COPY libs libs
COPY tsconfig.json tsconfig.json

RUN npm run build

FROM node:alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install --prod

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/chain/main"]