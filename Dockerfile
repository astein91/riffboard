# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Clerk publishable key must be available at build time (Vite inlines VITE_* vars)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

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

# Install build deps for better-sqlite3 + git for OpenCode
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (we need tsx for running TypeScript)
RUN pnpm install --frozen-lockfile && apk del python3 make g++

# Install OpenCode globally (Alpine uses musl — swap glibc binary with musl)
RUN npm install -g opencode-ai@1.1.59 opencode-linux-x64-musl@1.1.59 \
    && cp /usr/local/lib/node_modules/opencode-linux-x64-musl/bin/opencode \
          /usr/local/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode

# Copy server code
COPY server ./server

# Copy OpenCode config
COPY .opencode ./.opencode

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Create data directory for SQLite + project files
RUN mkdir -p /data && chmod 700 /data

# Expose port
EXPOSE 3456

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3456/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3456
ENV DB_PATH=/data/riffboard.db
ENV DATA_DIR=/data

# Start the server (migrations run automatically on boot)
CMD ["npx", "tsx", "server/index.ts"]
