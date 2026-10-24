package org.jahia.se.modules.exactlyImageGenerator.proxy;

import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHeaders;
import org.apache.http.HttpRequest;
import org.apache.http.HttpResponse;
import org.apache.http.ProtocolException;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.impl.client.LaxRedirectStrategy;
import org.apache.http.protocol.HttpContext;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.client.methods.HttpRequestBase;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.jahia.se.modules.exactlyImageGenerator.cfg.ExactlyConfiguration;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Deactivate;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Locale;
import java.util.Map;

/**
 * Low-level HTTP client for the Exactly.ai API.
 * <p>
 * One pooled client per component instance, with connect and read timeouts. The bearer token is only
 * ever sent to the configured API host; image downloads are bounded in size and never follow redirects
 * to another host with the token. Thread-safe.
 */
@Component(service = ExactlyProxyClient.class, immediate = true)
public class ExactlyProxyClient {

    private static final Logger logger = LoggerFactory.getLogger(ExactlyProxyClient.class);

    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int SOCKET_TIMEOUT_MS = 180_000;
    /** Largest generated image the module accepts to download (bytes). */
    public static final int MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

    @Reference
    private ExactlyConfiguration configuration;

    private CloseableHttpClient client;

    @Activate
    void activate() {
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(CONNECT_TIMEOUT_MS)
                .setConnectionRequestTimeout(CONNECT_TIMEOUT_MS)
                .setSocketTimeout(SOCKET_TIMEOUT_MS)
                .build();
        client = HttpClients.custom()
                .setDefaultRequestConfig(requestConfig)
                .setRedirectStrategy(new TokenSafeRedirectStrategy())
                .setMaxConnTotal(20)
                .setMaxConnPerRoute(10)
                .build();
    }

    /**
     * Follows redirects (the API answers some calls with one) but copies the {@code Authorization}
     * header only to the configured API host: HttpClient otherwise copies every header of the original
     * request, token included, to whatever host the redirect names.
     */
    private final class TokenSafeRedirectStrategy extends LaxRedirectStrategy {
        @Override
        public HttpUriRequest getRedirect(HttpRequest request, HttpResponse response, HttpContext context)
                throws ProtocolException {
            HttpUriRequest redirect = super.getRedirect(request, response, context);
            boolean keepAuth = isApiHost(redirect.getURI());
            for (Header header : request.getAllHeaders()) {
                if (keepAuth || !HttpHeaders.AUTHORIZATION.equalsIgnoreCase(header.getName())) {
                    redirect.addHeader(header);
                }
            }
            if (!redirect.headerIterator().hasNext()) {
                // An empty header set makes RedirectExec copy the original headers back.
                redirect.addHeader(HttpHeaders.ACCEPT, "*/*");
            }
            return redirect;
        }
    }

    @Deactivate
    void deactivate() throws IOException {
        if (client != null) {
            client.close();
        }
    }

    /** A downloaded binary and its declared media type. */
    public static final class Download {
        private final byte[] data;
        private final String mimeType;

        Download(byte[] data, String mimeType) {
            this.data = data;
            this.mimeType = mimeType;
        }

        public byte[] getData() {
            return data;
        }

        public String getMimeType() {
            return mimeType;
        }
    }

    /**
     * GET an API endpoint.
     *
     * @param endpoint path below the base URL, starting with {@code /}
     * @return the response body
     * @throws IOException on a network error or a non-2xx answer
     */
    public String get(String endpoint) throws IOException {
        return execute(new HttpGet(buildUrl(endpoint)));
    }

    /**
     * POST a JSON body to an API endpoint.
     *
     * @param endpoint path below the base URL
     * @param jsonBody body, or {@code null} for none
     * @return the response body
     * @throws IOException on a network error or a non-2xx answer
     */
    public String post(String endpoint, String jsonBody) throws IOException {
        HttpPost request = new HttpPost(buildUrl(endpoint));
        if (jsonBody != null) {
            request.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        }
        return execute(request);
    }

    /**
     * POST one file as multipart ({@code image} part) to an API endpoint.
     *
     * @param endpoint path below the base URL
     * @param fileName name of the uploaded file
     * @param data     file content
     * @return the response body
     * @throws IOException on a network error or a non-2xx answer
     */
    public String postFile(String endpoint, String fileName, byte[] data) throws IOException {
        HttpPost request = new HttpPost(buildUrl(endpoint));
        request.setEntity(MultipartEntityBuilder.create()
                .addBinaryBody("image", new ByteArrayInputStream(data), ContentType.APPLICATION_OCTET_STREAM, fileName)
                .build());
        return execute(request);
    }

    /**
     * PUT a JSON body to an API endpoint.
     *
     * @param endpoint path below the base URL
     * @param jsonBody body, or {@code null} for none
     * @return the response body
     * @throws IOException on a network error or a non-2xx answer
     */
    public String put(String endpoint, String jsonBody) throws IOException {
        HttpPut request = new HttpPut(buildUrl(endpoint));
        if (jsonBody != null) {
            request.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        }
        return execute(request);
    }

    /**
     * DELETE an API endpoint.
     *
     * @param endpoint path below the base URL
     * @return the response body
     * @throws IOException on a network error or a non-2xx answer
     */
    public String delete(String endpoint) throws IOException {
        return execute(new HttpDelete(buildUrl(endpoint)));
    }

    /**
     * Downloads an image URL that the Exactly API returned. Only {@code https} URLs are fetched; the
     * token is attached only when the URL is on the configured API host; the body is capped at
     * {@link #MAX_DOWNLOAD_BYTES}. Callers must only pass URLs the API itself issued.
     *
     * @param absoluteUrl the image URL
     * @return the bytes and media type
     * @throws IOException on a refused URL, a network error, a non-2xx answer or an oversized body
     */
    public Download download(String absoluteUrl) throws IOException {
        URI uri = URI.create(absoluteUrl);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            throw new IOException("Refused image URL (https only)");
        }
        HttpGet request = new HttpGet(uri);
        if (isApiHost(uri)) {
            addAuthHeader(request);
        }
        try (CloseableHttpResponse response = client.execute(request)) {
            int status = response.getStatusLine().getStatusCode();
            HttpEntity entity = response.getEntity();
            if (status < 200 || status >= 300 || entity == null) {
                EntityUtils.consumeQuietly(entity);
                throw new IOException("Image download failed: HTTP " + status);
            }
            if (entity.getContentLength() > MAX_DOWNLOAD_BYTES) {
                EntityUtils.consumeQuietly(entity);
                throw new IOException("Image too large");
            }
            ContentType contentType = ContentType.get(entity);
            String mimeType = contentType != null ? contentType.getMimeType().toLowerCase(Locale.ROOT) : null;
            return new Download(readBounded(entity.getContent()), mimeType);
        }
    }

    private static byte[] readBounded(InputStream in) throws IOException {
        try (InputStream input = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_DOWNLOAD_BYTES) {
                    throw new IOException("Image too large");
                }
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    private boolean isApiHost(URI uri) {
        String baseUrl = configuration.getApiBaseUrl();
        if (baseUrl == null) {
            return false;
        }
        URI base = URI.create(baseUrl);
        return base.getHost() != null && base.getHost().equalsIgnoreCase(uri.getHost());
    }

    private String execute(HttpRequestBase request) throws IOException {
        addAuthHeader(request);
        try (CloseableHttpResponse response = client.execute(request)) {
            int statusCode = response.getStatusLine().getStatusCode();
            HttpEntity entity = response.getEntity();
            String body = entity != null ? EntityUtils.toString(entity) : "";
            if (statusCode >= 200 && statusCode < 300) {
                logger.debug("Exactly API call successful: {} {}", request.getMethod(), statusCode);
                return body;
            }
            logger.warn("Exactly API call failed: {} {}", request.getMethod(), statusCode);
            logger.debug("Exactly API error body: {}", body);
            throw new IOException("API call failed: " + statusCode + " - " + body);
        }
    }

    private String buildUrl(String endpoint) throws IOException {
        if (!configuration.isConfigured()) {
            throw new IOException("Exactly API is not configured");
        }
        String baseUrl = configuration.getApiBaseUrl();
        if (baseUrl.endsWith("/") && endpoint.startsWith("/")) {
            return baseUrl + endpoint.substring(1);
        } else if (!baseUrl.endsWith("/") && !endpoint.startsWith("/")) {
            return baseUrl + "/" + endpoint;
        }
        return baseUrl + endpoint;
    }

    private void addAuthHeader(HttpRequestBase request) {
        String token = configuration.getApiToken();
        if (token != null) {
            request.addHeader("Authorization", "Bearer " + token);
        }
    }
}
