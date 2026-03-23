# --- Stage 1: Build test UI server (static Go binary, no libc dependency) ---
FROM golang:1.24-alpine AS gobuilder
WORKDIR /build
COPY test/server.go .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o test-server server.go

# --- Stage 2: Prepare files (line-ending + permission fix) ---
FROM alpine:3.21 AS prep

COPY entrypoint.sh /entrypoint.sh
COPY conf/ /conf/
COPY test/www/ /test/www/

# Fix CRLF → LF (handles Windows/macOS hosts) and set permissions.
# busybox-static: statically linked binary — no musl/glibc dependency,
# works in the Distroless (Debian-based) fluent-bit runtime image.
RUN apk add --no-cache busybox-static \
    && sed -i 's/\r$//' /entrypoint.sh /conf/*.conf /conf/*.lua \
    && chmod 755 /entrypoint.sh \
    && cp /bin/busybox.static /bin/bb-sh \
    && cp /bin/busybox.static /bin/bb-mkdir

# --- Stage 3: Runtime ---
FROM fluent/fluent-bit:3.2

COPY --from=prep /conf/fluent-bit.conf   /fluent-bit/etc/fluent-bit.conf
COPY --from=prep /conf/stdin.conf        /fluent-bit/etc/stdin.conf
COPY --from=prep /conf/parsers.conf      /fluent-bit/etc/parsers.conf
COPY --from=prep /conf/transform.lua     /fluent-bit/etc/transform.lua
COPY --from=prep /entrypoint.sh          /entrypoint.sh

# Shell (needed by entrypoint.sh shebang)
COPY --from=prep /bin/bb-sh              /bin/sh
COPY --from=prep /bin/bb-mkdir           /bin/mkdir

# Test console: static Go server + web files
COPY --from=gobuilder /build/test-server /test/server
COPY --from=prep /test/www/              /test/www/

# Default environment variables
ENV LOG_AGENT_LEVEL=info
ENV LOG_AGENT_FILE=/var/log/app/*.log
ENV LOG_AGENT_HOST=localhost
ENV LOG_AGENT_PORT=3001
ENV LOG_AGENT_TLS=off
ENV LOG_AGENT_TLS_VERIFY=on
ENV LOG_AGENT_API_KEY=changeme

# Test console (disabled by default)
ENV LOG_AGENT_WEB_CONSOLE=false
ENV LOG_AGENT_WEB_CONSOLE_PORT=8080

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
