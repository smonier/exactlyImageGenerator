package org.jahia.se.modules.exactlyImageGenerator.services;

import org.jahia.se.modules.exactlyImageGenerator.proxy.ExactlyProxyClient;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.util.*;

/**
 * High-level service for Exactly.ai API operations
 * Provides typed methods for common operations
 */
@Component(service = ExactlyService.class, immediate = true)
public class ExactlyService {
    
    private static final Logger logger = LoggerFactory.getLogger(ExactlyService.class);
    
    @Reference
    private ExactlyProxyClient proxyClient;
    
    @Reference
    private DamService damService;
    
    /**
     * List all models from Exactly API
     * GET /public/v1/models
     */
    public List<Map<String, Object>> listStyles() throws Exception {
        logger.info("Fetching models from Exactly API");
        String response = proxyClient.get("/public/v1/models");
        
        JSONObject json = new JSONObject(response);
        JSONArray styles = json.optJSONArray("items");
        
        if (styles == null) {
            return Collections.emptyList();
        }
        
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < styles.length(); i++) {
            JSONObject style = styles.getJSONObject(i);
            Map<String, Object> styleMap = new HashMap<>();
            styleMap.put("uid", style.optString("uid"));
            styleMap.put("name", style.optString("name"));
            styleMap.put("status", style.optString("status"));
            styleMap.put("active", style.optBoolean("active", false));
            styleMap.put("images_per_generation", style.optInt("images_per_generation", 1));
            styleMap.put("metadata", style.toString());
            result.add(styleMap);
        }
        
        logger.info("Fetched {} styles", result.size());
        return result;
    }
    
    /**
     * Create a new model
     * POST /public/v1/models
     */
    public Map<String, Object> createStyle(String name, String description) throws Exception {
        logger.info("Creating new model: {}", name);
        
        JSONObject payload = new JSONObject();
        payload.put("name", name);
        
        // Add custom_data object (required by API)
        JSONObject customData = new JSONObject();
        if (description != null && !description.trim().isEmpty()) {
            customData.put("description", description);
        }
        payload.put("custom_data", customData);
        
        String response = proxyClient.post("/public/v1/models", payload.toString());
        JSONObject json = new JSONObject(response);
        
        String uid = json.optString("uid");
        logger.info("Created model in Exactly.ai - Name: {}, UUID: {}", name, uid);
        
        Map<String, Object> result = new HashMap<>();
        result.put("uid", uid);
        
        // Use input name instead of API response to ensure it's set correctly
        result.put("name", name);
        
        // Handle empty/null status - default to 'draft' for newly created models
        String status = json.optString("status", "draft");
        if (status == null || status.trim().isEmpty()) {
            status = "draft";
        }
        result.put("status", status);
        result.put("active", json.optBoolean("active", false));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Delete a model by its UUID
     * DELETE /public/v1/models/{uid}/
     */
    public void deleteStyle(String styleId) throws Exception {
        logger.info("Deleting model: {}", styleId);
        proxyClient.delete("/public/v1/models/" + styleId + "/");
        logger.info("Successfully deleted model: {}", styleId);
    }
    
    /**
     * Upload training images to a model
     * POST /public/v1/models/{uid}/train_images (multipart)
     * Note: API expects one image per request
     */
    public Map<String, Object> uploadTrainingImages(String styleId, List<String> damAssetUuids) throws Exception {
        logger.info("Uploading {} training images for model: {}", damAssetUuids.size(), styleId);
        
        String endpoint = "/public/v1/models/" + styleId + "/train_images/";
        int successCount = 0;
        int failureCount = 0;
        StringBuilder errorMessages = new StringBuilder();
        
        // Upload each image individually
        for (String assetUuid : damAssetUuids) {
            try {
                InputStream stream = damService.getDamAssetStream(assetUuid);
                String fileName = damService.getDamAssetName(assetUuid);
                
                // Create single-file map for this upload
                Map<String, InputStream> singleFile = new HashMap<>();
                singleFile.put(fileName, stream);
                
                logger.info("Uploading image {} ({}) to endpoint: {}", fileName, assetUuid, endpoint);
                String response = proxyClient.postMultipart(endpoint, singleFile, null);
                logger.info("Upload successful for {}: {}", fileName, response);
                successCount++;
                
            } catch (Exception e) {
                logger.error("Failed to upload DAM asset: {}", assetUuid, e);
                failureCount++;
                errorMessages.append(assetUuid).append(": ").append(e.getMessage()).append("; ");
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("status", failureCount == 0 ? "success" : "partial");
        result.put("message", String.format("Uploaded %d/%d images", successCount, damAssetUuids.size()));
        result.put("successCount", successCount);
        result.put("failureCount", failureCount);
        if (failureCount > 0) {
            result.put("errors", errorMessages.toString());
        }
        
        return result;
    }
    
    /**
     * Get training images for a model
     * GET /public/v1/models/{uid}/train_images/
     */
    public List<Map<String, Object>> getTrainingImages(String styleId) throws Exception {
        logger.info("Fetching training images for model: {}", styleId);
        
        String endpoint = "/public/v1/models/" + styleId + "/train_images/";
        String response = proxyClient.get(endpoint);
        
        logger.info("Training images API raw response (first 200 chars): {}", 
            response.length() > 200 ? response.substring(0, 200) + "..." : response);
        
        List<Map<String, Object>> images = new ArrayList<>();
        
        try {
            // Try parsing as paginated response: {"count": N, "items": [...]}
            JSONObject responseObj = new JSONObject(response);
            logger.info("Response is JSON object with keys: {}", responseObj.keySet());
            
            JSONArray itemsArray = responseObj.optJSONArray("items");
            if (itemsArray != null) {
                logger.info("Found 'items' array with {} items", itemsArray.length());
                for (int i = 0; i < itemsArray.length(); i++) {
                    JSONObject itemObj = itemsArray.getJSONObject(i);
                    
                    // Each item has: {"uid": "...", "image": {"uid": "...", "url_set": {...}}}
                    String itemUid = itemObj.optString("uid");
                    JSONObject imageObj = itemObj.optJSONObject("image");
                    
                    if (imageObj != null) {
                        Map<String, Object> image = new HashMap<>();
                        image.put("id", itemUid);
                        image.put("imageId", imageObj.optString("uid"));
                        
                        // Extract URL from url_set.hires or url_set.lores
                        JSONObject urlSet = imageObj.optJSONObject("url_set");
                        if (urlSet != null) {
                            JSONObject hires = urlSet.optJSONObject("hires");
                            if (hires != null) {
                                image.put("url", hires.optString("url"));
                                image.put("width", hires.optInt("width"));
                                image.put("height", hires.optInt("height"));
                            }
                        }
                        
                        image.put("filename", "image_" + itemUid + ".jpg");
                        images.add(image);
                    }
                }
            } else {
                // Response is an object but no 'items' - maybe it's a single image or error?
                logger.warn("Response is JSON object but has no 'items' array. Keys: {}", responseObj.keySet());
            }
        } catch (JSONException e) {
            // Not a JSON object, try as direct array
            logger.warn("Response is not a JSON object, trying direct array parse");
            try {
                JSONArray jsonArray = new JSONArray(response);
                logger.info("Successfully parsed as direct array with {} items", jsonArray.length());
                for (int i = 0; i < jsonArray.length(); i++) {
                    JSONObject imageObj = jsonArray.getJSONObject(i);
                    Map<String, Object> image = new HashMap<>();
                    image.put("id", imageObj.optString("id"));
                    image.put("url", imageObj.optString("url"));
                    image.put("filename", imageObj.optString("filename"));
                    image.put("createdAt", imageObj.optString("created_at"));
                    images.add(image);
                }
            } catch (JSONException e2) {
                logger.error("Failed to parse response as array either. Response: {}", response);
                throw new Exception("Invalid API response format: " + e2.getMessage());
            }
        }
        
        logger.info("Retrieved {} training images", images.size());
        return images;
    }
    
    /**
     * Delete a training image from a model
     * DELETE /public/v1/models/{uid}/train_images/{image_uid}/
     */
    public void deleteTrainingImage(String styleId, String imageUid) throws Exception {
        logger.info("Deleting training image {} from model: {}", imageUid, styleId);
        
        String endpoint = "/public/v1/models/" + styleId + "/train_images/" + imageUid + "/";
        proxyClient.delete(endpoint);
        
        logger.info("Successfully deleted training image: {}", imageUid);
    }
    
    /**
     * Start training for a model
     * POST /public/v1/models/{uid}/train
     */
    public Map<String, Object> trainStyle(String styleId) throws Exception {
        logger.info("Starting training for model: {}", styleId);
        
        String endpoint = "/public/v1/models/" + styleId + "/train";
        String response = proxyClient.post(endpoint, null);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("jobId", json.optString("job_id"));
        result.put("status", json.optString("status"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Check training status
     * GET /public/v1/models/{uid}/train/progress
     */
    public Map<String, Object> getStyleStatus(String styleId) throws Exception {
        logger.info("Checking status for model: {}", styleId);
        
        String endpoint = "/public/v1/models/" + styleId + "/train/progress";
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("progress", json.optInt("progress", 0));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Get training progress (alias for getStyleStatus)
     * GET /public/v1/models/{uid}/train/progress
     */
    public Map<String, Object> getTrainingProgress(String styleId) throws Exception {
        return getStyleStatus(styleId);
    }
    
    /**
     * Put model back to draft state
     * POST /public/v1/models/{uid}/draft/
     */
    public Map<String, Object> putModelToDraft(String styleId) throws Exception {
        logger.info("Putting model to draft: {}", styleId);
        
        String endpoint = "/public/v1/models/" + styleId + "/draft/";
        String response = proxyClient.post(endpoint, null);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Cancel model training
     * POST /public/v1/models/{uid}/cancel/
     */
    public Map<String, Object> cancelTraining(String styleId) throws Exception {
        logger.info("Canceling training for model: {}", styleId);
        
        String endpoint = "/public/v1/models/" + styleId + "/cancel/";
        String response = proxyClient.post(endpoint, null);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Generate images with a prompt
     * POST /public/v1/images
     */
    public Map<String, Object> generateImages(String styleId, String prompt, String paramsJson) throws Exception {
        logger.info("Generating images for model: {} with prompt: {}", styleId, prompt);
        
        JSONObject payload = new JSONObject();
        payload.put("model_uid", styleId);
        payload.put("prompt", prompt);
        
        // Merge additional params if provided
        if (paramsJson != null && !paramsJson.trim().isEmpty()) {
            JSONObject params = new JSONObject(paramsJson);
            for (String key : params.keySet()) {
                payload.put(key, params.get(key));
            }
        }
        
        String response = proxyClient.post("/public/v1/images", payload.toString());
        JSONObject json = new JSONObject(response);
        
        List<String> urls = new ArrayList<>();
        JSONArray images = json.optJSONArray("images");
        if (images != null) {
            for (int i = 0; i < images.length(); i++) {
                JSONObject img = images.getJSONObject(i);
                String url = img.optString("url");
                if (url != null && !url.isEmpty()) {
                    urls.add(url);
                }
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("jobId", json.optString("job_id"));
        result.put("status", json.optString("status"));
        result.put("urls", urls);
        result.put("metadata", json.toString());
        
        logger.info("Generated {} images", urls.size());
        return result;
    }
    
    /**
     * Get a model by UID
     * GET /public/v1/models/{uid}
     */
    public Map<String, Object> getModel(String modelUid) throws Exception {
        logger.info("Fetching model: {}", modelUid);
        
        String endpoint = "/public/v1/models/" + modelUid;
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("id", json.optString("uid"));
        result.put("name", json.optString("name"));
        result.put("status", json.optString("status"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Delete a model
     * DELETE /public/v1/models/{uid}
     */
    public void deleteModel(String modelUid) throws Exception {
        logger.info("Deleting model: {}", modelUid);
        
        String endpoint = "/public/v1/models/" + modelUid;
        proxyClient.delete(endpoint);
    }
    
    /**
     * Put model into draft state
     * POST /public/v1/models/{uid}/draft
     */
    public Map<String, Object> putModelIntoDraft(String modelUid) throws Exception {
        logger.info("Putting model into draft: {}", modelUid);
        
        String endpoint = "/public/v1/models/" + modelUid + "/draft";
        String response = proxyClient.post(endpoint, null);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * List training images for a model
     * GET /public/v1/models/{uid}/train_images
     */
    public List<Map<String, Object>> listTrainingImages(String modelUid) throws Exception {
        logger.info("Listing training images for model: {}", modelUid);
        
        String endpoint = "/public/v1/models/" + modelUid + "/train_images";
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        JSONArray items = json.optJSONArray("items");
        
        if (items == null) {
            return Collections.emptyList();
        }
        
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            Map<String, Object> imageMap = new HashMap<>();
            imageMap.put("uid", item.optString("uid"));
            imageMap.put("url", item.optString("url"));
            imageMap.put("metadata", item.toString());
            result.add(imageMap);
        }
        
        return result;
    }
    
    /**
     * Download image from URL
     */
    public InputStream downloadImage(String url) throws Exception {
        logger.info("Downloading image from: {}", url);
        return proxyClient.getStreamFromUrl(url);
    }
    
    /**
     * Poll generation status / Get an image
     * GET /public/v1/images/{uid}
     */
    public Map<String, Object> getGenerationStatus(String jobId) throws Exception {
        logger.info("Checking generation status for job: {}", jobId);
        
        String endpoint = "/public/v1/images/" + jobId;
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        
        List<String> urls = new ArrayList<>();
        JSONArray images = json.optJSONArray("images");
        if (images != null) {
            for (int i = 0; i < images.length(); i++) {
                JSONObject img = images.getJSONObject(i);
                String url = img.optString("url");
                if (url != null && !url.isEmpty()) {
                    urls.add(url);
                }
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("urls", urls);
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Upscale an image
     * POST /public/v1/images/{uid}/upscales
     */
    public Map<String, Object> upscaleImage(String imageUid, int scale) throws Exception {
        logger.info("Upscaling image {} with scale: {}", imageUid, scale);
        
        JSONObject payload = new JSONObject();
        payload.put("scale", scale);
        
        String endpoint = "/public/v1/images/" + imageUid + "/upscales";
        String response = proxyClient.post(endpoint, payload.toString());
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("url", json.optString("url"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Get image upscale
     * GET /public/v1/images/{uid}/upscales/{scale}
     */
    public Map<String, Object> getUpscaledImage(String imageUid, int scale) throws Exception {
        logger.info("Getting upscaled image {} with scale: {}", imageUid, scale);
        
        String endpoint = "/public/v1/images/" + imageUid + "/upscales/" + scale;
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("url", json.optString("url"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Vectorize an image
     * POST /public/v1/images/{uid}/vectors
     */
    public Map<String, Object> vectorizeImage(String imageUid) throws Exception {
        logger.info("Vectorizing image: {}", imageUid);
        
        String endpoint = "/public/v1/images/" + imageUid + "/vectors";
        String response = proxyClient.post(endpoint, null);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("url", json.optString("url"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Get the last image vector
     * GET /public/v1/images/{uid}/vectors
     */
    public Map<String, Object> getVectorizedImage(String imageUid) throws Exception {
        logger.info("Getting vectorized image: {}", imageUid);
        
        String endpoint = "/public/v1/images/" + imageUid + "/vectors";
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("url", json.optString("url"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Remove background from an image
     * POST /public/v1/images/{uid}/remove-bg
     */
    public Map<String, Object> removeBackground(String imageUid) throws Exception {
        logger.info("Removing background from image: {}", imageUid);
        
        String endpoint = "/public/v1/images/" + imageUid + "/remove-bg";
        String response = proxyClient.post(endpoint, null);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("url", json.optString("url"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /**
     * Get the last background-removed image
     * GET /public/v1/images/{uid}/remove-bg
     */
    public Map<String, Object> getBackgroundRemovedImage(String imageUid) throws Exception {
        logger.info("Getting background-removed image: {}", imageUid);
        
        String endpoint = "/public/v1/images/" + imageUid + "/remove-bg";
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("status", json.optString("status"));
        result.put("url", json.optString("url"));
        result.put("metadata", json.toString());
        
        return result;
    }
}
