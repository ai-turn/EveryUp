# =============================================================================
# MT Monitoring - Full-Stack Dockerfile
# Build context: repo root (c:\dev\mt-app or git repo root)
# Result: Single container — Go backend serves API + React SPA
# Supports: linux/amd64, linux/arm64
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build React Frontend
# -----------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend

WORKDIR /build/frontend

# Enable corepack to use pnpm without separate install
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfile + manifest first for layer caching
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY frontend/ ./

# Production build: mock off, API served from same origin
ENV VITE_USE_MOCK=false
ENV VITE_API_BASE_URL=/api/v1

RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 2: Build Go Backend
# -----------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS backend

ARG TARGETOS=linux
ARG TARGETARCH

WORKDIR /build/backend

# Copy go module files first for layer caching
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy source code
COPY backend/ ./

# Cross-compile for target platform
# CGO_ENABLED=0: pure Go SQLite driver (modernc.org/sqlite)
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-w -s" \
    -o server ./cmd/server

# -----------------------------------------------------------------------------
# Stage 3: Final minimal image
# -----------------------------------------------------------------------------
FROM alpine:3.19

# Essential packages only
RUN apk add --no-cache ca-certificates tzdata

# Non-root user for security
RUN addgroup -g 1000 monitoring && \
    adduser -u 1000 -G monitoring -s /bin/sh -D monitoring

WORKDIR /app

# Binary from backend build
COPY --from=backend /build/backend/server ./server

# Frontend static files → Go serves these from ./web/
COPY --from=frontend /build/frontend/dist ./web

# Default config (users can override via volume mount or env vars)
COPY backend/config.example.json ./config.json

# Data directory
RUN mkdir -p /app/data && chown -R monitoring:monitoring /app

USER monitoring

# Environment variables (override with docker run -e or compose environment)
ENV MT_SERVER_HOST=0.0.0.0
ENV MT_SERVER_PORT=3001
ENV MT_DATABASE_PATH=/app/data/monitoring.db
ENV TZ=UTC

EXPOSE 3001

# Persist database and config
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

CMD ["./server"]
