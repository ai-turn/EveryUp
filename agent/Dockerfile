FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -o /out/everyup-agent ./cmd/everyup-agent

FROM alpine:3.21

RUN adduser -D -H everyup \
    && mkdir -p /data /etc/everyup/generated \
    && chown -R everyup:everyup /data /etc/everyup

COPY --from=build /out/everyup-agent /usr/local/bin/everyup-agent

USER everyup

EXPOSE 4318

ENTRYPOINT ["everyup-agent"]
