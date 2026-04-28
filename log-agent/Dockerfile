# --- Stage 1: Prepare files (line-ending + permission fix) ---
FROM alpine:3.21 AS prep

COPY entrypoint.sh /entrypoint.sh
COPY conf/ /conf/

# Fix CRLF -> LF and set permissions.
# busybox-static provides a shell for the Distroless Fluent Bit runtime image.
RUN apk add --no-cache busybox-static \
    && sed -i 's/\r$//' /entrypoint.sh /conf/*.conf /conf/*.lua \
    && chmod 755 /entrypoint.sh \
    && cp /bin/busybox.static /bin/bb-sh

# --- Stage 2: Runtime ---
FROM fluent/fluent-bit:3.2

COPY --from=prep /conf/fluent-bit.conf /fluent-bit/etc/fluent-bit.conf
COPY --from=prep /conf/stdin.conf      /fluent-bit/etc/stdin.conf
COPY --from=prep /conf/parsers.conf    /fluent-bit/etc/parsers.conf
COPY --from=prep /conf/transform.lua   /fluent-bit/etc/transform.lua
COPY --from=prep /entrypoint.sh        /entrypoint.sh

# Shell needed by entrypoint.sh shebang.
COPY --from=prep /bin/bb-sh /bin/sh

# Default environment variables.
ENV LOG_AGENT_LEVEL=info
ENV LOG_AGENT_FILE=/var/log/app/*.log
ENV LOG_AGENT_HOST=localhost
ENV LOG_AGENT_PORT=3001
ENV LOG_AGENT_TLS=off
ENV LOG_AGENT_TLS_VERIFY=on
ENV LOG_AGENT_API_KEY=changeme

ENTRYPOINT ["/entrypoint.sh"]
