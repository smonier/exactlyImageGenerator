package org.jahia.se.modules.exactlyImageGenerator.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.osgi.BundleUtils;
import org.jahia.se.modules.exactlyImageGenerator.services.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.util.*;

/**
 * GraphQL mutations for Exactly.ai operations
 */
@GraphQLName("ExactlyMutations")
@GraphQLDescription("Exactly.ai Image Generator mutations")
public class ExactlyMutations {
    
    private static final Logger logger = LoggerFactory.getLogger(ExactlyMutations.class);
    
    private ExactlyService exactlyService;
    private JcrStyleRepository styleRepository;
    private DamService damService;
    
    public ExactlyMutations() {
        this.exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        this.styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        this.damService = BundleUtils.getOsgiService(DamService.class, null);
    }
    
    /**
     * Extract user-friendly error message from API exception
     */
    private String extractApiErrorMessage(String exceptionMessage) {
        if (exceptionMessage == null) {
            return "An unknown error occurred";
        }
        
        // Pattern: "API call failed: 400 - {\"message\": \"Not enough images...\", ...}"
        int jsonStart = exceptionMessage.indexOf("{");
        if (jsonStart >= 0) {
            try {
                String jsonPart = exceptionMessage.substring(jsonStart);
                org.json.JSONObject json = new org.json.JSONObject(jsonPart);
                String message = json.optString("message");
                if (!message.isEmpty()) {
                    return message;
                }
            } catch (Exception e) {
                // Fall through to default handling
            }
        }
        
        // Fallback: return original message
        return exceptionMessage;
    }
    
    /**
     * Sync styles from Exactly.ai
     */
    @GraphQLField
    @GraphQLName("syncStyles")
    @GraphQLDescription("Sync all styles from Exactly.ai to JCR")
    public ExactlySyncResponse syncStyles(@GraphQLName("siteKey") String siteKey) {
        logger.info("GraphQL: syncStyles called for site: {}", siteKey);
        
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        
        try {
            // Get all models from Exactly.ai
            List<Map<String, Object>> models = exactlyService.listStyles();
            
            // Save/update each model in JCR
            for (Map<String, Object> model : models) {
                String exactlyId = (String) model.get("uid");
                String name = (String) model.get("name");
                String status = (String) model.get("status");
                Boolean active = (Boolean) model.get("active");
                
                styleRepository.findOrCreateStyle(siteKey, exactlyId, name, status, active, null);
            }
            
            return new ExactlySyncResponseImpl(true, "Synced " + models.size() + " styles");
        } catch (Exception e) {
            logger.error("Error syncing styles", e);
            return new ExactlySyncResponseImpl(false, "Error: " + e.getMessage());
        }
    }
    
    /**
     * Create a new style in Exactly.ai
     */
    @GraphQLField
    @GraphQLName("createStyle")
    @GraphQLDescription("Create a new style in Exactly.ai")
    public ExactlySyncResponse createStyle(
            @GraphQLName("siteKey") String siteKey,
            @GraphQLName("name") String name,
            @GraphQLName("description") String description) {
        logger.info("GraphQL: createStyle called - name: {}, site: {}", name, siteKey);
        
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        
        try {
            // Create model in Exactly.ai
            Map<String, Object> model = exactlyService.createStyle(name, description);
            String exactlyId = (String) model.get("uid");
            String status = (String) model.get("status");
            
            // Create node in JCR
            styleRepository.findOrCreateStyle(siteKey, exactlyId, name, status, true, null);
            
            return new ExactlySyncResponseImpl(true, exactlyId);
        } catch (Exception e) {
            logger.error("Error creating style", e);
            String errorMessage = extractApiErrorMessage(e.getMessage());
            return new ExactlySyncResponseImpl(false, errorMessage);
        }
    }
    
    /**
     * Delete a style from Exactly.ai
     */
    @GraphQLField
    @GraphQLName("deleteStyle")
    @GraphQLDescription("Delete a style from Exactly.ai and JCR")
    public ExactlySyncResponse deleteStyle(@GraphQLName("styleUuid") String styleUuid) {
        logger.info("GraphQL: deleteStyle called for style: {}", styleUuid);
        
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        
        try {
            // Get exactlyId from JCR
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            
            // Delete from Exactly.ai
            exactlyService.deleteStyle(exactlyId);
            
            // Delete from JCR
            styleRepository.deleteStyle(styleUuid);
            
            return new ExactlySyncResponseImpl(true, "Style deleted successfully");
        } catch (Exception e) {
            logger.error("Error deleting style", e);
            String errorMessage = extractApiErrorMessage(e.getMessage());
            return new ExactlySyncResponseImpl(false, errorMessage);
        }
    }
    
    /**
     * Get training images from Exactly
     */
    @GraphQLField
    @GraphQLName("getTrainingImages")
    @GraphQLDescription("Get training images from Exactly.ai for a style")
    public ExactlySyncResponse getTrainingImages(@GraphQLName("styleUuid") String styleUuid) {
        logger.info("GraphQL: getTrainingImages called for style: {}", styleUuid);
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            
            if (exactlyId == null || exactlyId.isEmpty()) {
                logger.warn("No Exactly ID found for style UUID: {}", styleUuid);
                // Return empty array for styles not yet synced with Exactly.ai
                return new ExactlySyncResponseImpl(true, "[]");
            }
            
            List<Map<String, Object>> imagesList = exactlyService.getTrainingImages(exactlyId);
            
            org.json.JSONArray jsonArray = new org.json.JSONArray(imagesList);
            String imagesJson = jsonArray.toString();
            
            logger.info("Retrieved {} training images", imagesList.size());
            return new ExactlySyncResponseImpl(true, imagesJson);
            
        } catch (Exception e) {
            logger.error("Error fetching training images from Exactly.ai", e);
            return new ExactlySyncResponseImpl(false, "Error: " + e.getMessage());
        }
    }
    
    /**
     * Delete training image from Exactly
     */
    @GraphQLField
    @GraphQLName("deleteTrainingImage")
    @GraphQLDescription("Delete a training image from Exactly.ai")
    public ExactlySyncResponse deleteTrainingImage(
            @GraphQLName("styleUuid") String styleUuid,
            @GraphQLName("imageUid") String imageUid) {
        logger.info("GraphQL: deleteTrainingImage called - style: {}, image: {}", styleUuid, imageUid);
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            exactlyService.deleteTrainingImage(exactlyId, imageUid);
            
            logger.info("Successfully deleted training image: {}", imageUid);
            return new ExactlySyncResponseImpl(true, "Image deleted successfully");
            
        } catch (Exception e) {
            logger.error("Error deleting training image from Exactly.ai", e);
            String errorMessage = extractApiErrorMessage(e.getMessage());
            return new ExactlySyncResponseImpl(false, errorMessage);
        }
    }
    
    /**
     * Upload training images to Exactly
     */
    @GraphQLField
    @GraphQLName("uploadTrainingImages")
    @GraphQLDescription("Upload training images to Exactly.ai for a style")
    public ExactlySyncResponse uploadTrainingImages(
            @GraphQLName("styleUuid") String styleUuid,
            @GraphQLName("damAssetUuids") List<String> damAssetUuids) {
        logger.info("GraphQL: uploadTrainingImages called - style: {}, {} images", styleUuid, damAssetUuids.size());
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        if (damService == null) {
            damService = BundleUtils.getOsgiService(DamService.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            Map<String, Object> result = exactlyService.uploadTrainingImages(exactlyId, damAssetUuids);
            
            String message = (String) result.get("message");
            boolean success = "success".equals(result.get("status")) || "partial".equals(result.get("status"));
            
            logger.info("Upload result: {}", message);
            return new ExactlySyncResponseImpl(success, message);
            
        } catch (Exception e) {
            logger.error("Error uploading training images", e);
            return new ExactlySyncResponseImpl(false, "Error: " + e.getMessage());
        }
    }
    
    /**
     * Train a style
     */
    @GraphQLField
    @GraphQLName("trainStyle")
    @GraphQLDescription("Start training for a style")
    public ExactlySyncResponse trainStyle(@GraphQLName("styleUuid") String styleUuid) {
        logger.info("GraphQL: trainStyle called for style: {}", styleUuid);
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            Map<String, Object> result = exactlyService.trainStyle(exactlyId);
            
            // Return job ID and status as JSON in message
            org.json.JSONObject jsonResult = new org.json.JSONObject(result);
            String resultJson = jsonResult.toString();
            
            logger.info("Training started successfully");
            return new ExactlySyncResponseImpl(true, resultJson);
            
        } catch (Exception e) {
            logger.error("Error starting training", e);
            
            // Extract API error message from exception
            String errorMessage = extractApiErrorMessage(e.getMessage());
            return new ExactlySyncResponseImpl(false, errorMessage);
        }
    }
    
    /**
     * Get training progress
     */
    @GraphQLField
    @GraphQLName("getTrainingProgress")
    @GraphQLDescription("Get training progress for a style")
    public ExactlySyncResponse getTrainingProgress(@GraphQLName("styleUuid") String styleUuid) {
        logger.info("GraphQL: getTrainingProgress called for style: {}", styleUuid);
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            
            if (exactlyId == null || exactlyId.isEmpty()) {
                logger.warn("No Exactly ID found for style UUID: {}", styleUuid);
                // Return a default response indicating the style is in draft state
                org.json.JSONObject defaultProgress = new org.json.JSONObject();
                defaultProgress.put("status", "draft");
                defaultProgress.put("progress", 0);
                return new ExactlySyncResponseImpl(true, defaultProgress.toString());
            }
            
            Map<String, Object> progress = exactlyService.getTrainingProgress(exactlyId);
            
            // Return progress as JSON in message
            org.json.JSONObject jsonProgress = new org.json.JSONObject(progress);
            String progressJson = jsonProgress.toString();
            
            return new ExactlySyncResponseImpl(true, progressJson);
            
        } catch (Exception e) {
            logger.error("Error getting training progress", e);
            return new ExactlySyncResponseImpl(false, "Error: " + e.getMessage());
        }
    }
    
    /**
     * Put model to draft state
     */
    @GraphQLField
    @GraphQLName("putModelToDraft")
    @GraphQLDescription("Put model back to draft state to add more images and retrain")
    public ExactlySyncResponse putModelToDraft(@GraphQLName("styleUuid") String styleUuid) {
        logger.info("GraphQL: putModelToDraft called for style: {}", styleUuid);
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            Map<String, Object> result = exactlyService.putModelToDraft(exactlyId);
            
            org.json.JSONObject jsonResult = new org.json.JSONObject(result);
            String resultJson = jsonResult.toString();
            
            logger.info("Model put to draft successfully");
            return new ExactlySyncResponseImpl(true, resultJson);
            
        } catch (Exception e) {
            logger.error("Error putting model to draft", e);
            String errorMessage = extractApiErrorMessage(e.getMessage());
            return new ExactlySyncResponseImpl(false, errorMessage);
        }
    }
    
    /**
     * Cancel model training
     */
    @GraphQLField
    @GraphQLName("cancelTraining")
    @GraphQLDescription("Cancel ongoing model training")
    public ExactlySyncResponse cancelTraining(@GraphQLName("styleUuid") String styleUuid) {
        logger.info("GraphQL: cancelTraining called for style: {}", styleUuid);
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            Map<String, Object> result = exactlyService.cancelTraining(exactlyId);
            
            org.json.JSONObject jsonResult = new org.json.JSONObject(result);
            String resultJson = jsonResult.toString();
            
            logger.info("Training canceled successfully");
            return new ExactlySyncResponseImpl(true, resultJson);
            
        } catch (Exception e) {
            logger.error("Error canceling training", e);
            String errorMessage = extractApiErrorMessage(e.getMessage());
            return new ExactlySyncResponseImpl(false, errorMessage);
        }
    }
    
    /**
     * Generate images with a style and prompt
     */
    @GraphQLField
    @GraphQLName("generateImages")
    @GraphQLDescription("Generate images using a trained style and prompt")
    public ExactlySyncResponse generateImages(
            @GraphQLName("styleUuid") String styleUuid,
            @GraphQLName("prompt") String prompt,
            @GraphQLName("paramsJson") String paramsJson) {
        logger.info("GraphQL: generateImages called for style: {} with prompt: {}", styleUuid, prompt);
        
        // Lazy load services
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        if (styleRepository == null) {
            styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
        }
        
        try {
            String exactlyId = styleRepository.getExactlyId(styleUuid);
            
            if (exactlyId == null || exactlyId.isEmpty()) {
                logger.warn("No Exactly ID found for style UUID: {}", styleUuid);
                return new ExactlySyncResponseImpl(false, "Style not found or not synced with Exactly.ai");
            }
            
            Map<String, Object> result = exactlyService.generateImages(exactlyId, prompt, paramsJson);
            
            // Return result as JSON in message
            org.json.JSONObject jsonResult = new org.json.JSONObject(result);
            String resultJson = jsonResult.toString();
            
            logger.info("Images generated successfully");
            return new ExactlySyncResponseImpl(true, resultJson);
            
        } catch (Exception e) {
            logger.error("Error generating images", e);
            String errorMessage = extractApiErrorMessage(e.getMessage());
            return new ExactlySyncResponseImpl(false, errorMessage);
        }
    }

    /**
     * Save generated images to DAM
     * POST operation to download images and save them to JCR
     */
    @GraphQLField
    @GraphQLName("saveGeneratedImagesToDam")
    public ExactlySyncResponse saveGeneratedImagesToDam(
            @GraphQLName("projectNodeUuid") String projectNodeUuid,
            @GraphQLName("targetFolderPath") String targetFolderPath,
            @GraphQLName("targetFolderUuid") String targetFolderUuid,
            @GraphQLName("selectionJson") String selectionJson) {
        
        logger.info("GraphQL: saveGeneratedImagesToDam called");
        
        if (damService == null) {
            damService = BundleUtils.getOsgiService(DamService.class, null);
        }
        if (exactlyService == null) {
            exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
        }
        
        try {
            // Parse selection JSON
            org.json.JSONArray selection = new org.json.JSONArray(selectionJson);
            logger.info("Saving {} images to DAM at {}", selection.length(), targetFolderPath);
            
            int savedCount = 0;
            for (int i = 0; i < selection.length(); i++) {
                org.json.JSONObject item = selection.getJSONObject(i);
                String remoteUrl = item.getString("remoteUrl");
                String fileName = item.getString("fileName");
                String title = item.optString("title", fileName);
                
                try {
                    // Download image from Exactly.ai
                    InputStream imageStream = exactlyService.downloadImage(remoteUrl);
                    
                    // Determine MIME type from file extension
                    String mimeType = "image/png";
                    if (fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")) {
                        mimeType = "image/jpeg";
                    }
                    
                    // Save to DAM
                    damService.createDamAsset(targetFolderPath, fileName, mimeType, imageStream, title);
                    savedCount++;
                    logger.info("Saved image {} to DAM: {}", i + 1, fileName);
                    
                } catch (Exception e) {
                    logger.error("Failed to save image {}: {}", fileName, e.getMessage());
                    // Continue with next image
                }
            }
            
            if (savedCount == 0) {
                return new ExactlySyncResponseImpl(false, "Failed to save any images");
            }
            
            return new ExactlySyncResponseImpl(true, "Successfully saved " + savedCount + " of " + selection.length() + " images");
            
        } catch (Exception e) {
            logger.error("Error saving images to DAM", e);
            return new ExactlySyncResponseImpl(false, "Error: " + e.getMessage());
        }
    }
}
