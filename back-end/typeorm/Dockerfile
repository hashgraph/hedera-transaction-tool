FROM node:22-alpine AS builder

WORKDIR /usr/src/app

RUN npm install -g pnpm

# Copy workspace config and root package files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY typeorm ./typeorm

RUN pnpm install --ignore-scripts

RUN pnpm build:migrations

# Production stage - minimal runtime image
FROM node:22-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist/typeorm ./dist/typeorm
COPY --from=builder /usr/src/app/node_modules ./node_modules
# how do i tell if it is in dist yet?
# COPY --from=builder /app/typeorm/data-source.js ./dist/typeorm/

# Install TypeORM CLI globally (or use npx)
RUN npm install -g typeorm

# Run migrations (use env vars for DB config)
CMD ["typeorm", "migration:run", "--dataSource", "dist/typeorm/data-source.js"]