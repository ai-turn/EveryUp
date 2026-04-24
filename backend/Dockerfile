# =============================================================================
# Backend-only Dockerfile
# Build context: everyup/
# Use this for backend-only deployments (API without frontend).
#
# For the full-stack build (backend + frontend in one container),
# use the Dockerfile at the repo root:
#   docker build -f Dockerfile -t everyup .   (from repo root)
#   docker compose up                               (from repo root)
# =============================================================================

FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

ARG TARGETOS=linux
ARG TARGETARCH=amd64

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-w -s" -o server ./cmd/server

# Final image
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 1000 app && \
    adduser -u 1000 -G app -s /bin/sh -D app

WORKDIR /app

COPY --from=builder /app/server .
COPY config.example.json ./config.json

RUN mkdir -p /app/data /app/web && chown -R app:app /app

USER app

ENV EVERYUP_SERVER_HOST=0.0.0.0
ENV EVERYUP_SERVER_PORT=3001
ENV EVERYUP_DATABASE_PATH=/app/data/monitoring.db

EXPOSE 3001
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

CMD ["./server"]
