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

# Skip Puppeteer bundled Chromium download (@sparticuz/chromium used instead)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

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
# - Fonts for proper PDF rendering (@sparticuz/chromium provides its own Chromium)
# - Shared libraries required by Chromium on Debian slim
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    fonts-liberation \
    fonts-noto-color-emoji \
    curl \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libglib2.0-0 \
    libasound2 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libxi6 \
    libxrender1 \
    libxtst6 \
    libxss1 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc-s1 \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer configuration (@sparticuz/chromium handles executable path at runtime)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

# Copy node_modules from builder
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=appuser:nodejs . .

# Create uploads directory and set permissions
RUN mkdir -p uploads/logos && \
    chown -R appuser:nodejs uploads

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server.js"]
