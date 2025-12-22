FROM node:22-alpine AS builder

WORKDIR /usr/src/app

RUN npm install -g pnpm

# Copy workspace config and root package files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Copy source files
COPY typeorm ./typeorm
COPY libs ./libs

RUN pnpm install -F typeorm --ignore-scripts

# Build the common library (contains entities)
RUN pnpm build:common

# Build migrations
RUN pnpm build:migrations

# Production stage - minimal runtime image
FROM node:22-alpine

WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN npm install -g pnpm

COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml

COPY --from=builder /usr/src/app/typeorm/package.json ./typeorm/package.json

ENV CI=true

# Install only typeorm production dependencies
RUN pnpm install --prod --filter typeorm --ignore-scripts

# Copy compiled code
COPY --from=builder /usr/src/app/dist/typeorm ./dist/typeorm
COPY --from=builder /usr/src/app/dist/libs ./dist/libs

# Run migration script
CMD ["pnpm", "-F", "typeorm", "migration:run"]