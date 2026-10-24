package org.jahia.se.modules.exactlyImageGenerator.services;

import org.jahia.se.modules.exactlyImageGenerator.cfg.ExactlyConfiguration;
import org.jahia.se.modules.exactlyImageGenerator.proxy.ExactlyProxyClient;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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
    private ExactlyConfiguration configuration;
    
    /**
     * Build API endpoint path using configured path and version
     */
    /** Generation options a caller may set, see the Exactly "create images" call. */
    private static final List<String> GENERATION_PARAMS = Arrays.asList("num_images", "size", "reference_images");

    /** The API's own {@code message} from {@code API call failed: <status> - {...}}, else the text as is. */
    private static String apiMessage(String text) {
        int jsonStart = text != null ? text.indexOf('{') : -1;
        if (jsonStart >= 0) {
            try {
                String message = new JSONObject(text.substring(jsonStart)).optString("message");
                if (!message.isEmpty()) {
                    return message;
                }
            } catch (JSONException e) {
                // not JSON: keep the text
            }
        }
        return text;
    }

    private static String id(String value) {
        return ExactlyAccessService.requireExternalId(value);
    }

    private String buildEndpoint(String resource) {
        return "/" + configuration.getApiPath() + "/" + configuration.getApiVersion() + resource;
    }
    
    /**
     * List all models from Exactly API
     * GET /public/v1/models
     */
    public List<Map<String, Object>> listStyles() throws Exception {
        logger.debug("Fetching models from Exactly API");
        String response = proxyClient.get(buildEndpoint("/models/"));
        
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
        
        logger.debug("Fetched {} styles", result.size());
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
        
        String response = proxyClient.post(buildEndpoint("/models/"), payload.toString());
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
        proxyClient.delete(buildEndpoint("/models/" + id(styleId) + "/"));
        logger.info("Successfully deleted model: {}", styleId);
    }
    
    /**
     * Upload training images to a model
     * POST /public/v1/models/{uid}/train_images (multipart)
     * Note: API expects one image per request
     */
    public Map<String, Object> uploadTrainingImages(String styleId, List<DamService.DamImage> images) {
        logger.info("Uploading {} training images for model: {}", images.size(), styleId);

        String endpoint = buildEndpoint("/models/" + id(styleId) + "/train_images/");
        int successCount = 0;
        int failureCount = 0;
        StringBuilder errorMessages = new StringBuilder();

        // The API takes one image per request
        for (DamService.DamImage image : images) {
            try {
                proxyClient.postFile(endpoint, image.getName(), image.getData());
                successCount++;
            } catch (Exception e) {
                logger.warn("Failed to upload training image {}: {}", image.getName(), e.getMessage());
                failureCount++;
                if (errorMessages.length() > 0) {
                    errorMessages.append("; ");
                }
                errorMessages.append(image.getName()).append(": ").append(apiMessage(e.getMessage()));
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", failureCount == 0 ? "success" : (successCount == 0 ? "failed" : "partial"));
        result.put("message", String.format("Uploaded %d/%d images", successCount, images.size()));
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
        logger.debug("Fetching training images for model: {}", styleId);
        
        String endpoint = buildEndpoint("/models/" + id(styleId) + "/train_images/");
        String response = proxyClient.get(endpoint);
        
        logger.debug("Training images API raw response (first 200 chars): {}", 
            response.length() > 200 ? response.substring(0, 200) + "..." : response);
        
        List<Map<String, Object>> images = new ArrayList<>();
        
        try {
            // Try parsing as paginated response: {"count": N, "items": [...]}
            JSONObject responseObj = new JSONObject(response);
            logger.debug("Response is JSON object with keys: {}", responseObj.keySet());
            
            JSONArray itemsArray = responseObj.optJSONArray("items");
            if (itemsArray != null) {
                logger.debug("Found 'items' array with {} items", itemsArray.length());
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
                logger.debug("Successfully parsed as direct array with {} items", jsonArray.length());
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
                logger.warn("Training images response is neither an object nor an array");
                throw new Exception("Invalid API response format: " + e2.getMessage());
            }
        }
        
        logger.debug("Retrieved {} training images", images.size());
        return images;
    }
    
    /**
     * Delete a training image from a model
     * DELETE /public/v1/models/{uid}/train_images/{image_uid}/
     */
    public void deleteTrainingImage(String styleId, String imageUid) throws Exception {
        logger.info("Deleting training image {} from model: {}", imageUid, styleId);
        
        String endpoint = buildEndpoint("/models/" + id(styleId) + "/train_images/" + id(imageUid) + "/");
        proxyClient.delete(endpoint);
        
        logger.info("Successfully deleted training image: {}", imageUid);
    }
    
    /**
     * Start training for a model
     * POST /public/v1/models/{uid}/train
     */
    public Map<String, Object> trainStyle(String styleId) throws Exception {
        logger.info("Starting training for model: {}", styleId);
        
        String endpoint = buildEndpoint("/models/" + id(styleId) + "/train/");
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
        logger.debug("Checking status for model: {}", styleId);
        
        String endpoint = buildEndpoint("/models/" + id(styleId) + "/train/progress/");
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
        
        String endpoint = buildEndpoint("/models/" + id(styleId) + "/draft/");
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
        
        String endpoint = buildEndpoint("/models/" + id(styleId) + "/cancel/");
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
        logger.debug("Generating images for model: {}", styleId);
        
        JSONObject payload = new JSONObject();
        payload.put("model_uid", styleId);
        payload.put("prompt", prompt);
        
        // Merge the generation options the UI offers; model_uid and prompt are never overridden
        if (paramsJson != null && !paramsJson.trim().isEmpty()) {
            JSONObject params = new JSONObject(paramsJson);
            for (String key : GENERATION_PARAMS) {
                if (params.has(key)) {
                    payload.put(key, params.get(key));
                }
            }
        }
        
        String response = proxyClient.post(buildEndpoint("/images/"), payload.toString());
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
        logger.debug("Fetching model: {}", modelUid);
        
        String endpoint = buildEndpoint("/models/" + id(modelUid) + "/");
        String response = proxyClient.get(endpoint);
        
        JSONObject json = new JSONObject(response);
        Map<String, Object> result = new HashMap<>();
        result.put("id", json.optString("uid"));
        result.put("name", json.optString("name"));
        result.put("status", json.optString("status"));
        result.put("metadata", json.toString());
        
        return result;
    }
    
    /** Side of the style thumbnails (px), square. */
    static final int THUMBNAIL_SIZE = 160;

    /**
     * Thumbnail of a style: its first training image, center-cropped and scaled to a
     * {@value #THUMBNAIL_SIZE} px square JPEG, as a {@code data:} URL small enough to keep on the style
     * node (a few kB). One API call and one download.
     *
     * @param styleId Exactly model id
     * @return the data URL, or {@code null} when the style has no training image or it cannot be read
     */
    public String thumbnailDataUrl(String styleId) {
        try {
            for (Map<String, Object> image : getTrainingImages(styleId)) {
                Object url = image.get("url");
                if (url instanceof String && ((String) url).startsWith("https://")) {
                    BufferedImage source = ImageIO.read(new ByteArrayInputStream(proxyClient.download((String) url).getData()));
                    return source == null ? null : "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(squareJpeg(source));
                }
            }
        } catch (Exception e) {
            logger.debug("No thumbnail for model {}: {}", styleId, e.getMessage());
        }
        return null;
    }

    private static byte[] squareJpeg(BufferedImage source) throws java.io.IOException {
        int side = Math.min(source.getWidth(), source.getHeight());
        BufferedImage target = new BufferedImage(THUMBNAIL_SIZE, THUMBNAIL_SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            int x = (source.getWidth() - side) / 2;
            int y = (source.getHeight() - side) / 2;
            g.drawImage(source, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE, x, y, x + side, y + side, null);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(target, "jpg", out);
        return out.toByteArray();
    }

    /**
     * Downloads an image URL that the API returned for a generation (see {@link GeneratedImageRegistry}).
     *
     * @param url an image URL issued by Exactly
     * @return the image bytes and media type
     * @throws java.io.IOException when the URL is refused or the download fails
     */
    public ExactlyProxyClient.Download downloadImage(String url) throws java.io.IOException {
        return proxyClient.download(url);
    }
}
