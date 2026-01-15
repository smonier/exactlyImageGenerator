package org.jahia.se.modules.exactlyImageGenerator.graphql;

public class ExactlySyncResponseImpl implements ExactlySyncResponse {
    
    private boolean successful;
    private String message;
    
    public ExactlySyncResponseImpl(boolean successful, String message) {
        this.successful = successful;
        this.message = message;
    }
    
    @Override
    public boolean isSuccessful() {
        return successful;
    }
    
    @Override
    public String getMessage() {
        return message;
    }
}
