package org.jahia.se.modules.exactlyImageGenerator.cfg;

import org.osgi.service.cm.ManagedService;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Dictionary;

/**
 * OSGi configuration of the Exactly.ai API, PID {@code org.jahia.se.modules.exactlyImageGenerator}.
 * <p>
 * Every value comes from the configuration file only (the bundled {@code .cfg} ships the product
 * defaults and an empty token): the module is "configured" once the token, base URL, path and version
 * are all set. Fields are volatile because {@link #updated(Dictionary)} runs on the Configuration Admin
 * thread while GraphQL requests read them.
 */
@Component(service = {ExactlyConfiguration.class, ManagedService.class},
        property = "service.pid=org.jahia.se.modules.exactlyImageGenerator", immediate = true)
public class ExactlyConfiguration implements ManagedService {

    private static final Logger logger = LoggerFactory.getLogger(ExactlyConfiguration.class);

    private static final String PROP_API_TOKEN = "exactly.api.token";
    private static final String PROP_API_BASE_URL = "exactly.api.baseUrl";
    private static final String PROP_API_PATH = "exactly.api.path";
    private static final String PROP_API_VERSION = "exactly.api.version";

    private volatile String apiToken;
    private volatile String apiBaseUrl;
    private volatile String apiPath;
    private volatile String apiVersion;

    /**
     * Reads the configuration. A removed or blank value clears the previous one, so deleting the token
     * really disables the module.
     *
     * @param properties the configuration, or {@code null} when it was deleted
     */
    @Override
    public void updated(Dictionary<String, ?> properties) {
        apiToken = read(properties, PROP_API_TOKEN);
        apiBaseUrl = read(properties, PROP_API_BASE_URL);
        apiPath = read(properties, PROP_API_PATH);
        apiVersion = read(properties, PROP_API_VERSION);
        if (isConfigured()) {
            logger.info("Exactly API configured - Base URL: {}, Path: {}, Version: {}", apiBaseUrl, apiPath, apiVersion);
        } else {
            logger.warn("Exactly API is not fully configured (token, baseUrl, path and version are required)");
        }
    }

    private static String read(Dictionary<String, ?> properties, String key) {
        if (properties == null) {
            return null;
        }
        Object value = properties.get(key);
        if (value == null || value.toString().trim().isEmpty()) {
            return null;
        }
        return value.toString().trim();
    }

    /** @return the bearer token, or {@code null} when not configured */
    public String getApiToken() {
        return apiToken;
    }

    /** @return the API base URL (scheme and host), or {@code null} when not configured */
    public String getApiBaseUrl() {
        return apiBaseUrl;
    }

    /** @return the API path segment, or {@code null} when not configured */
    public String getApiPath() {
        return apiPath;
    }

    /** @return the API version segment, or {@code null} when not configured */
    public String getApiVersion() {
        return apiVersion;
    }

    /** @return {@code true} when the token, base URL, path and version are all set */
    public boolean isConfigured() {
        return apiToken != null && apiBaseUrl != null && apiPath != null && apiVersion != null;
    }
}
