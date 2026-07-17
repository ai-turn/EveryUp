import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public final class FixtureServer {
    private static final String FIXTURE_NAME = System.getenv().getOrDefault("FIXTURE_NAME", "java-api");

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/", FixtureServer::handle);
        server.setExecutor(Executors.newCachedThreadPool());
        Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(1)));
        server.start();
        System.out.printf("{\"event\":\"listening\",\"fixture\":\"%s\",\"port\":%d}%n", escape(FIXTURE_NAME), port);
    }

    private static void handle(HttpExchange exchange) throws IOException {
        long startedAt = System.nanoTime();
        int status = 500;
        String path = exchange.getRequestURI().getPath();
        try {
            switch (path) {
                case "/health" -> {
                    status = 200;
                    send(exchange, status, "{\"status\":\"ok\",\"fixture\":\"" + escape(FIXTURE_NAME) + "\"}");
                }
                case "/ok" -> {
                    status = 200;
                    send(exchange, status, "{\"ok\":true,\"runtime\":\"java\",\"fixture\":\"" + escape(FIXTURE_NAME) + "\"}");
                }
                case "/slow" -> {
                    int delayMs = queryDelay(exchange.getRequestURI());
                    try {
                        Thread.sleep(delayMs);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                    }
                    status = 200;
                    send(exchange, status, "{\"ok\":true,\"delayed_ms\":" + delayMs + "}");
                }
                case "/error" -> {
                    status = 503;
                    send(exchange, status, "{\"ok\":false,\"error\":\"intentional fixture failure\"}");
                }
                case "/echo" -> {
                    String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                    status = 200;
                    send(exchange, status, "{\"echo\":\"" + escape(requestBody) + "\"}");
                }
                case "/large" -> {
                    status = 200;
                    send(exchange, status, "{\"payload\":\"" + "x".repeat(10000) + "\"}");
                }
                case "/env" -> {
                    String options = System.getenv().getOrDefault("JAVA_TOOL_OPTIONS", "");
                    boolean baselinePreserved = "true".equals(System.getProperty("fixture.baseline"));
                    status = 200;
                    send(exchange, status, "{\"fixture\":\"" + escape(FIXTURE_NAME) + "\",\"java_tool_options\":\""
                            + escape(options) + "\",\"baseline_preserved\":" + baselinePreserved + "}");
                }
                default -> {
                    status = 404;
                    send(exchange, status, "{\"ok\":false,\"error\":\"not found\"}");
                }
            }
        } catch (Exception exception) {
            status = 500;
            send(exchange, status, "{\"ok\":false,\"error\":\"internal fixture error\"}");
            System.err.printf("{\"event\":\"handler_error\",\"fixture\":\"%s\",\"message\":\"%s\"}%n",
                    escape(FIXTURE_NAME), escape(exception.getMessage()));
        } finally {
            double durationMs = (System.nanoTime() - startedAt) / 1_000_000.0;
            System.out.printf("{\"event\":\"http_request\",\"fixture\":\"%s\",\"method\":\"%s\",\"path\":\"%s\",\"status\":%d,\"duration_ms\":%.2f}%n",
                    escape(FIXTURE_NAME), escape(exchange.getRequestMethod()), escape(path), status, durationMs);
        }
    }

    private static int queryDelay(URI uri) {
        String query = uri.getRawQuery();
        if (query == null) return 500;
        for (String part : query.split("&")) {
            String[] pair = part.split("=", 2);
            if (pair.length == 2 && pair[0].equals("ms")) {
                try {
                    return Math.min(Math.max(Integer.parseInt(pair[1]), 0), 5000);
                } catch (NumberFormatException ignored) {
                    return 500;
                }
            }
        }
        return 500;
    }

    private static void send(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("X-Fixture-Runtime", "java");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String escape(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }
}
