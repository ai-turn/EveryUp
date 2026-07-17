FROM node:22-alpine

WORKDIR /app
COPY server.js ./server.js

RUN addgroup -S fixture && adduser -S fixture -G fixture
USER fixture

EXPOSE 8080
CMD ["node", "server.js"]
