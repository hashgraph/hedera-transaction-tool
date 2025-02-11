# Stage 1: Builder
FROM node:22.12 AS builder
# Install system dependencies needed for building
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        xvfb \
        libgtk-3-0 \
        libx11-xcb1 \
        libnss3 \
        libasound2 \
        libxcb-dri3-0 \
        libdrm2 \
        libgbm1 \
        libnotify4 \
        libgconf-2-4 \
        libxss1 \
        xauth \
        dbus \
        curl \
        python3 \
        python-is-python3 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Install pnpm globally
RUN npm install -g pnpm
# --- Build Front-End ---
# Copy only the package files to cache dependency installation
COPY front-end/package.json front-end/pnpm-lock.yaml ./front-end/
# Notice gen copy is needed for postinstall script
COPY notice-gen ./notice-gen
# Install dependencies and build front-end
RUN cd front-end && pnpm install --frozen-lockfile \
  --fetch-retries=5 \
  --fetch-retry-factor=2 \
  --fetch-retry-mintimeout=30000 \
  --fetch-retry-maxtimeout=300000
# Copy over the full front-end source and build
COPY front-end ./front-end
RUN cd front-end && \
    pnpm run generate:database && \
    pnpm run build:docker
# --- Build Automation ---
# Copy automation package files for caching
COPY automation/package.json automation/pnpm-lock.yaml ./automation/
RUN cd automation && pnpm install --frozen-lockfile
# Now copy the rest of the automation source
COPY automation ./automation
# Stage 2: Runtime
FROM node:22.12-slim
# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        xvfb \
        libgtk-3-0 \
        libx11-xcb1 \
        libnss3 \
        libasound2 \
        libxcb-dri3-0 \
        libdrm2 \
        libgbm1 \
        libnotify4 \
        libgconf-2-4 \
        libxss1 \
        xauth \
        dbus \
        curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy the built artifacts from the builder stage
COPY --from=builder /app/front-end /app/front-end
COPY --from=builder /app/automation /app/automation
COPY --from=builder /app/notice-gen /app/notice-gen
ENTRYPOINT ["/bin/bash", "-c", "Xvfb :99 -screen 0 1920x1080x24 & cd /app/automation && npx playwright test tests/TransactionTests"]