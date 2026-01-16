package org.jahia.se.modules.exactlyImageGenerator.cfg;

import org.osgi.service.cm.ConfigurationException;
import org.osgi.service.cm.ManagedService;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Dictionary;

/**
 * OSGi configuration handler for Exactly.ai API settings
 * PID: org.jahia.se.modules.exactlyImageGenerator
 */
@Component(service = {ExactlyConfiguration.class, ManagedService.class}, property = "service.pid=org.jahia.se.modules.exactlyImageGenerator", immediate = true)
public class ExactlyConfiguration implements ManagedService {
    
    private static final Logger logger = LoggerFactory.getLogger(ExactlyConfiguration.class);
    
    private static final String PROP_API_TOKEN = "exactly.api.token";
    private static final String PROP_API_BASE_URL = "exactly.api.baseUrl";
    private static final String PROP_API_PATH = "exactly.api.path";
    private static final String PROP_API_VERSION = "exactly.api.version";
    private static final String DEFAULT_BASE_URL = "https://api.exactly.ai";
    private static final String DEFAULT_API_PATH = "public";
    private static final String DEFAULT_API_VERSION = "v1";
    
    private volatile String apiToken;
    private volatile String apiBaseUrl = DEFAULT_BASE_URL;
    private volatile String apiPath = DEFAULT_API_PATH;
    private volatile String apiVersion = DEFAULT_API_VERSION;
    
    @Override
    public void updated(Dictionary<String, ?> properties) throws ConfigurationException {
        if (properties != null) {
            Object token = properties.get(PROP_API_TOKEN);
            Object baseUrl = properties.get(PROP_API_BASE_URL);
            Object path = properties.get(PROP_API_PATH);
            Object version = properties.get(PROP_API_VERSION);
            
            if (token == null || token.toString().trim().isEmpty()) {
                logger.warn("Exactly API token is not configured. Module functionality will be limited.");
            } else {
                this.apiToken = token.toString().trim();
                logger.info("Exactly API token configured (length: {})", apiToken.length());
            }
            
            if (baseUrl != null && !baseUrl.toString().trim().isEmpty()) {
                this.apiBaseUrl = baseUrl.toString().trim();
            } else {
                this.apiBaseUrl = DEFAULT_BASE_URL;
            }
            
            if (path != null && !path.toString().trim().isEmpty()) {
                this.apiPath = path.toString().trim();
            } else {
                this.apiPath = DEFAULT_API_PATH;
            }
            
            if (version != null && !version.toString().trim().isEmpty()) {
                this.apiVersion = version.toString().trim();
            } else {
                this.apiVersion = DEFAULT_API_VERSION;
            }
            
            logger.info("Exactly API configuration - Base URL: {}, Path: {}, Version: {}", apiBaseUrl, apiPath, apiVersion);
        }
    }
    
    public String getApiToken() {
        return apiToken;
    }
    
    public String getApiBaseUrl() {
        return apiBaseUrl;
    }
    
    public String getApiPath() {
        return apiPath;
    }
    
    public String getApiVersion() {
        return apiVersion;
    }
    
    public boolean isConfigured() {
        return apiToken != null && !apiToken.trim().isEmpty();
    }
}
