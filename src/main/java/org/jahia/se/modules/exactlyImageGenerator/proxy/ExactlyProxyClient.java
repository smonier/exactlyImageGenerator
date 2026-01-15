package org.jahia.se.modules.exactlyImageGenerator.proxy;

import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.*;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.client.LaxRedirectStrategy;
import org.apache.http.util.EntityUtils;
import org.jahia.se.modules.exactlyImageGenerator.cfg.ExactlyConfiguration;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/**
 * Low-level HTTP client for Exactly.ai API
 * Handles authentication, streaming, multipart uploads
 */
@Component(service = ExactlyProxyClient.class, immediate = true)
public class ExactlyProxyClient {
    
    private static final Logger logger = LoggerFactory.getLogger(ExactlyProxyClient.class);
    
    @Reference
    private ExactlyConfiguration configuration;
    
    /**
     * Create HTTP client with redirect support
     */
    private CloseableHttpClient createHttpClient() {
        return HttpClients.custom()
            .setRedirectStrategy(new LaxRedirectStrategy())
            .build();
    }
    
    /**
     * Execute GET request
     */
    public String get(String endpoint) throws IOException {
        String url = buildUrl(endpoint);
        HttpGet request = new HttpGet(url);
        addAuthHeader(request);
        
        try (CloseableHttpClient client = createHttpClient()) {
            HttpResponse response = client.execute(request);
            return handleResponse(response);
        }
    }
    
    /**
     * Execute POST request with JSON body
     */
    public String post(String endpoint, String jsonBody) throws IOException {
        String url = buildUrl(endpoint);
        HttpPost request = new HttpPost(url);
        addAuthHeader(request);
        
        if (jsonBody != null) {
            request.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        }
        
        try (CloseableHttpClient client = createHttpClient()) {
            HttpResponse response = client.execute(request);
            return handleResponse(response);
        }
    }
    
    /**
     * Execute POST with multipart file upload
     */
    public String postMultipart(String endpoint, Map<String, InputStream> files, Map<String, String> fields) throws IOException {
        String url = buildUrl(endpoint);
        HttpPost request = new HttpPost(url);
        addAuthHeader(request);
        
        MultipartEntityBuilder builder = MultipartEntityBuilder.create();
        
        // Add fields
        if (fields != null) {
            fields.forEach((key, value) -> builder.addTextBody(key, value));
        }
        
        // Add files
        if (files != null) {
            files.forEach((fileName, inputStream) -> {
                builder.addBinaryBody("image", inputStream, ContentType.APPLICATION_OCTET_STREAM, fileName);
            });
        }
        
        request.setEntity(builder.build());
        
        try (CloseableHttpClient client = createHttpClient()) {
            HttpResponse response = client.execute(request);
            return handleResponse(response);
        }
    }
    
    /**
     * Download file as input stream (for image downloads)
     */
    public InputStream getStream(String endpoint) throws IOException {
        String url = buildUrl(endpoint);
        HttpGet request = new HttpGet(url);
        addAuthHeader(request);
        
        CloseableHttpClient client = createHttpClient();
        HttpResponse response = client.execute(request);
        
        int statusCode = response.getStatusLine().getStatusCode();
        if (statusCode >= 200 && statusCode < 300) {
            return response.getEntity().getContent();
        } else {
            client.close();
            throw new IOException("Failed to download: " + statusCode + " - " + response.getStatusLine().getReasonPhrase());
        }
    }
    
    /**
     * Download from absolute URL (for generated images)
     */
    public InputStream getStreamFromUrl(String absoluteUrl) throws IOException {
        HttpGet request = new HttpGet(absoluteUrl);
        addAuthHeader(request);
        
        CloseableHttpClient client = createHttpClient();
        HttpResponse response = client.execute(request);
        
        int statusCode = response.getStatusLine().getStatusCode();
        if (statusCode >= 200 && statusCode < 300) {
            return response.getEntity().getContent();
        } else {
            client.close();
            throw new IOException("Failed to download from URL: " + statusCode);
        }
    }
    
    /**
     * Execute PUT request
     */
    public String put(String endpoint, String jsonBody) throws IOException {
        String url = buildUrl(endpoint);
        HttpPut request = new HttpPut(url);
        addAuthHeader(request);
        
        if (jsonBody != null) {
            request.setEntity(new StringEntity(jsonBody, ContentType.APPLICATION_JSON));
        }
        
        try (CloseableHttpClient client = createHttpClient()) {
            HttpResponse response = client.execute(request);
            return handleResponse(response);
        }
    }
    
    /**
     * Execute DELETE request
     */
    public String delete(String endpoint) throws IOException {
        String url = buildUrl(endpoint);
        HttpDelete request = new HttpDelete(url);
        addAuthHeader(request);
        
        try (CloseableHttpClient client = createHttpClient()) {
            HttpResponse response = client.execute(request);
            return handleResponse(response);
        }
    }
    
    private String buildUrl(String endpoint) {
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
        if (token != null && !token.trim().isEmpty()) {
            request.addHeader("Authorization", "Bearer " + token);
        }
    }
    
    private String handleResponse(HttpResponse response) throws IOException {
        int statusCode = response.getStatusLine().getStatusCode();
        HttpEntity entity = response.getEntity();
        String body = entity != null ? EntityUtils.toString(entity) : "";
        
        if (statusCode >= 200 && statusCode < 300) {
            logger.debug("API call successful: {}", statusCode);
            return body;
        } else {
            logger.error("API call failed: {} - {}", statusCode, body);
            throw new IOException("API call failed: " + statusCode + " - " + body);
        }
    }
}
