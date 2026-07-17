FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /src
COPY FixtureServer.java FixtureHealthcheck.java ./
RUN mkdir -p /out && \
    javac --add-modules jdk.httpserver -d /out FixtureServer.java FixtureHealthcheck.java && \
    jar --create --file /app.jar --main-class FixtureServer -C /out .

FROM eclipse-temurin:21-jdk-alpine

RUN addgroup -S fixture && adduser -S fixture -G fixture
WORKDIR /app
COPY --from=build /app.jar /app/app.jar
USER fixture

EXPOSE 8080
ENTRYPOINT ["java", "--add-modules", "jdk.httpserver", "-jar", "/app/app.jar"]
