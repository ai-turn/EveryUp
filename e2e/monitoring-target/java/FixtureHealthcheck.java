import java.net.HttpURLConnection;
import java.net.URI;

public final class FixtureHealthcheck {
    public static void main(String[] args) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create("http://127.0.0.1:8080/health").toURL().openConnection();
        connection.setConnectTimeout(1000);
        connection.setReadTimeout(1000);
        connection.setRequestMethod("GET");
        int status = connection.getResponseCode();
        connection.disconnect();
        if (status < 200 || status >= 300) System.exit(1);
    }
}
