# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./

# Build frontend
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (we need tsx for running TypeScript)
RUN pnpm install --frozen-lockfile

# Copy server code
COPY server ./server

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Create directory for API keys storage
RUN mkdir -p /data && chmod 700 /data

# Expose port
EXPOSE 3456

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3456/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3456
ENV KEYS_FILE=/data/riffboard-keys.json

# Start the server
CMD ["npx", "tsx", "server/index.ts"]
