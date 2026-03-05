# ============================================
# Rural Tourism Backend - Production Dockerfile
# ============================================
# Multi-stage build: build native deps → slim runtime

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (bcrypt, mysql2)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install all dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ============================================
# Runtime stage
# ============================================
FROM node:${NODE_VERSION}-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Install runtime dependencies
# - Chromium for Puppeteer (PDF generation)
# - Fonts for proper PDF rendering
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer configuration
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p uploads/logos && \
    chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
