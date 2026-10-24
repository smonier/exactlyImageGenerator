package org.jahia.se.modules.exactlyImageGenerator.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.se.modules.exactlyImageGenerator.proxy.ExactlyProxyClient;
import org.jahia.se.modules.exactlyImageGenerator.services.DamService;
import org.jahia.se.modules.exactlyImageGenerator.services.GeneratedImageRegistry;
import org.jahia.se.modules.exactlyImageGenerator.services.JcrStyleRepository;
import org.jahia.services.content.JCRContentUtils;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Exactly fields that change something, under {@code Mutation.exactly}.
 * <p>
 * Each field resolves its site or style with the caller's session and needs {@code jContentAccess}
 * and {@code jcr:write_default} there ({@link org.jahia.se.modules.exactlyImageGenerator.services.ExactlyAccessService});
 * JCR writes are made with the caller's session too. Answers carry a result message or JSON in
 * {@code message}; see {@link ExactlyOperations} for the error policy.
 */
@GraphQLName("ExactlyMutations")
@GraphQLDescription("Exactly.ai Image Generator mutations")
public class ExactlyMutations extends ExactlyOperations {

    private static final Logger logger = LoggerFactory.getLogger(ExactlyMutations.class);

    static final int MAX_TRAINING_IMAGES_PER_CALL = 50;
    static final int MAX_PROMPT_LENGTH = 2000;
    static final int MAX_TITLE_LENGTH = 200;
    static final int MAX_FILE_NAME_LENGTH = 60;

    @GraphQLField
    @GraphQLName("syncStyles")
    @GraphQLDescription("Copy the models of the Exactly account into the site's styles folder")
    public ExactlySyncResponse syncStyles(@GraphQLName("siteKey") @GraphQLNonNull String siteKey) {
        return run("syncStyles", () -> {
            JCRSessionWrapper session = access.userSession();
            JCRSiteNode site = access.requireSite(session, siteKey, true);
            List<Map<String, Object>> models = exactlyService.listStyles();
            List<String> failed = new ArrayList<>();
            for (Map<String, Object> model : models) {
                String metadata = (String) model.get("metadata");
                try {
                    JCRNodeWrapper style = styleRepository.saveStyle(session, site, new JcrStyleRepository.StyleData(
                            (String) model.get("uid"), (String) model.get("name"), (String) model.get("status"),
                            (Boolean) model.get("active"), metadata, descriptionOf(metadata)));
                    // Thumbnails are made once, then kept: the list shows them without calling Exactly
                    if (!styleRepository.hasThumbnail(style)) {
                        styleRepository.setThumbnail(style, exactlyService.thumbnailDataUrl((String) model.get("uid")));
                    }
                } catch (IllegalArgumentException | javax.jcr.RepositoryException e) {
                    // One model the site cannot store must not stop the others
                    session.refresh(false);
                    logger.warn("Style {} not synced: {}", model.get("uid"), e.getMessage());
                    failed.add(String.valueOf(model.get("name")));
                }
            }
            Set<String> accountIds = new LinkedHashSet<>();
            for (Map<String, Object> model : models) {
                accountIds.add((String) model.get("uid"));
            }
            // Styles whose model was deleted on Exactly.ai are removed: the list mirrors the account
            styleRepository.removeStylesNotIn(session, site, accountIds);
            if (failed.isEmpty()) {
                return success("Synced " + models.size() + " styles");
            }
            return failure("Synced " + (models.size() - failed.size()) + " of " + models.size()
                    + " styles; not synced: " + String.join(", ", failed));
        });
    }

    @GraphQLField
    @GraphQLName("createStyle")
    @GraphQLDescription("Create a model on Exactly and its style node on the site")
    public ExactlySyncResponse createStyle(@GraphQLName("siteKey") @GraphQLNonNull String siteKey,
                                           @GraphQLName("name") @GraphQLNonNull String name,
                                           @GraphQLName("description") String description) {
        return run("createStyle", () -> {
            if (name.trim().isEmpty() || name.length() > MAX_TITLE_LENGTH) {
                throw new IllegalArgumentException("Invalid style name");
            }
            JCRSessionWrapper session = access.userSession();
            JCRSiteNode site = access.requireSite(session, siteKey, true);
            Map<String, Object> model = exactlyService.createStyle(name.trim(), description);
            String exactlyId = (String) model.get("uid");
            JCRNodeWrapper style = styleRepository.saveStyle(session, site, new JcrStyleRepository.StyleData(
                    exactlyId, name.trim(), (String) model.get("status"), true, (String) model.get("metadata"), description));
            return success(style.getIdentifier());
        });
    }

    @GraphQLField
    @GraphQLName("deleteStyle")
    @GraphQLDescription("Delete a style on Exactly and its node")
    public ExactlySyncResponse deleteStyle(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid) {
        return run("deleteStyle", () -> {
            JCRNodeWrapper style = access.requireStyle(access.userSession(), styleUuid, true);
            String exactlyId = styleRepository.getExactlyId(style);
            if (exactlyId != null) {
                try {
                    exactlyService.deleteStyle(exactlyId);
                } catch (java.io.IOException e) {
                    // A model already gone from the account must not keep its style node forever
                    if (!isUnknownModel(e)) {
                        throw e;
                    }
                    logger.info("Model {} is not on Exactly.ai any more: removing its style only", exactlyId);
                }
            }
            styleRepository.deleteStyle(style);
            return success("Style deleted");
        });
    }

    @GraphQLField
    @GraphQLName("deleteTrainingImage")
    @GraphQLDescription("Delete a training image of a style on Exactly")
    public ExactlySyncResponse deleteTrainingImage(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid,
                                                   @GraphQLName("imageUid") @GraphQLNonNull String imageUid) {
        return run("deleteTrainingImage", () -> {
            JCRNodeWrapper style = access.requireStyle(access.userSession(), styleUuid, true);
            String exactlyId = exactlyIdOf(style);
            exactlyService.deleteTrainingImage(exactlyId, imageUid);
            // The deleted image may have been the one of the thumbnail
            styleRepository.setThumbnail(style, exactlyService.thumbnailDataUrl(exactlyId));
            return success("Image deleted");
        });
    }

    @GraphQLField
    @GraphQLName("uploadTrainingImages")
    @GraphQLDescription("Send images of the media library the caller can read to Exactly as training images of a style")
    public ExactlySyncResponse uploadTrainingImages(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid,
                                                    @GraphQLName("damAssetUuids") @GraphQLNonNull List<String> damAssetUuids) {
        return run("uploadTrainingImages", () -> {
            Set<String> uuids = new LinkedHashSet<>(damAssetUuids);
            if (uuids.isEmpty() || uuids.size() > MAX_TRAINING_IMAGES_PER_CALL) {
                throw new IllegalArgumentException("Select between 1 and " + MAX_TRAINING_IMAGES_PER_CALL + " images");
            }
            JCRSessionWrapper session = access.userSession();
            JCRNodeWrapper style = access.requireStyle(session, styleUuid, true);
            String exactlyId = exactlyIdOf(style);
            // Read and check every image first, with the caller's session: nothing is sent while one is
            // refused, and the answer names every refused image at once
            List<DamService.DamImage> images = new ArrayList<>();
            List<String> refused = new ArrayList<>();
            for (String uuid : uuids) {
                try {
                    images.add(damService.readImage(session, uuid));
                } catch (IllegalArgumentException e) {
                    refused.add(e.getMessage());
                }
            }
            if (!refused.isEmpty()) {
                return failure("Nothing was sent. " + String.join("; ", refused));
            }
            Map<String, Object> result = exactlyService.uploadTrainingImages(exactlyId, images);
            if (!styleRepository.hasThumbnail(style)) {
                styleRepository.setThumbnail(style, exactlyService.thumbnailDataUrl(exactlyId));
            }
            String message = (String) result.get("message");
            if (result.get("errors") != null) {
                message += " - " + result.get("errors");
            }
            return new ExactlySyncResponseImpl(!"failed".equals(result.get("status")), message);
        });
    }

    @GraphQLField
    @GraphQLName("trainStyle")
    @GraphQLDescription("Start training a style; answers the job as JSON in message")
    public ExactlySyncResponse trainStyle(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid) {
        return modelCommand("trainStyle", styleUuid, "training", exactlyId -> exactlyService.trainStyle(exactlyId));
    }

    @GraphQLField
    @GraphQLName("putModelToDraft")
    @GraphQLDescription("Put a trained style back to draft to add images and train again")
    public ExactlySyncResponse putModelToDraft(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid) {
        return modelCommand("putModelToDraft", styleUuid, "draft", exactlyId -> exactlyService.putModelToDraft(exactlyId));
    }

    @GraphQLField
    @GraphQLName("cancelTraining")
    @GraphQLDescription("Cancel the training of a style")
    public ExactlySyncResponse cancelTraining(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid) {
        return modelCommand("cancelTraining", styleUuid, "draft", exactlyId -> exactlyService.cancelTraining(exactlyId));
    }

    @GraphQLField
    @GraphQLName("generateImages")
    @GraphQLDescription("Generate images with a trained style; answers {generationId, status, urls} as JSON in message")
    public ExactlySyncResponse generateImages(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid,
                                              @GraphQLName("prompt") @GraphQLNonNull String prompt,
                                              @GraphQLName("paramsJson") String paramsJson) {
        return run("generateImages", () -> {
            if (prompt.trim().isEmpty() || prompt.length() > MAX_PROMPT_LENGTH) {
                throw new IllegalArgumentException("The prompt must hold 1 to " + MAX_PROMPT_LENGTH + " characters");
            }
            JCRSessionWrapper session = access.userSession();
            JCRNodeWrapper style = access.requireStyle(session, styleUuid, true);
            Map<String, Object> result = exactlyService.generateImages(exactlyIdOf(style), prompt, paramsJson);
            @SuppressWarnings("unchecked")
            List<String> urls = (List<String>) result.get("urls");
            String generationId = generations.register(session.getUser().getUsername(),
                    style.getResolveSite().getSiteKey(), styleUuid, prompt, urls);
            return success(new JSONObject()
                    .put("generationId", generationId)
                    .put("status", result.get("status"))
                    .put("urls", urls)
                    .toString());
        });
    }

    @GraphQLField
    @GraphQLName("saveGeneratedImages")
    @GraphQLDescription("Save images of a generation to a folder of the site's media library")
    public ExactlySyncResponse saveGeneratedImages(@GraphQLName("generationId") @GraphQLNonNull String generationId,
                                                   @GraphQLName("indices") @GraphQLNonNull List<Integer> indices,
                                                   @GraphQLName("targetFolderPath") String targetFolderPath,
                                                   @GraphQLName("title") String title) {
        return run("saveGeneratedImages", () -> {
            JCRSessionWrapper session = access.userSession();
            GeneratedImageRegistry.Generation generation = generations.get(generationId, session.getUser().getUsername());
            if (generation == null) {
                return failure("This generation has expired: generate the images again");
            }
            // The generation was allowed on this site; the caller must still be allowed now
            access.requireStyle(session, generation.getStyleUuid(), true);
            JCRSiteNode site = access.requireSite(session, generation.getSiteKey(), true);
            JCRNodeWrapper folder = damService.resolveTargetFolder(session, site, targetFolderPath);
            String fileTitle = title != null && !title.trim().isEmpty()
                    ? truncate(title.trim(), MAX_TITLE_LENGTH) : truncate(generation.getPrompt(), MAX_TITLE_LENGTH);
            // The file name follows the title (a node name: lower case, dashes); createImage makes it unique
            String baseName = JCRContentUtils.generateNodeName(fileTitle, MAX_FILE_NAME_LENGTH);
            if (baseName.isEmpty()) {
                baseName = "exactly-" + generationId.substring(0, 8);
            }

            Set<Integer> wanted = new LinkedHashSet<>(indices);
            List<String> urls = generation.getUrls();
            int saved = 0;
            int position = 0;
            for (Integer index : wanted) {
                position++;
                if (index == null || index < 0 || index >= urls.size()) {
                    throw new IllegalArgumentException("Invalid image index");
                }
                try {
                    ExactlyProxyClient.Download image = exactlyService.downloadImage(urls.get(index));
                    String extension = extensionOf(image.getMimeType());
                    if (extension == null) {
                        logger.warn("Generated image {} has an unexpected type: {}", index, image.getMimeType());
                        continue;
                    }
                    String fileName = baseName + (wanted.size() > 1 ? "-" + position : "") + extension;
                    damService.createImage(folder, fileName, image.getMimeType(), image.getData(), fileTitle);
                    saved++;
                } catch (java.io.IOException e) {
                    logger.warn("Failed to download generated image {}: {}", index, e.getMessage());
                }
            }
            if (saved == 0) {
                return failure("No image could be saved");
            }
            session.save();
            return success(new JSONObject().put("saved", saved).put("requested", wanted.size())
                    .put("folderPath", folder.getPath()).toString());
        });
    }

    /** Exactly call on a style's model that also records the style's new status. */
    @FunctionalInterface
    private interface ModelCall {
        Map<String, Object> apply(String exactlyId) throws Exception;
    }

    private ExactlySyncResponse modelCommand(String name, String styleUuid, String fallbackStatus, ModelCall call) {
        return run(name, () -> {
            JCRNodeWrapper style = access.requireStyle(access.userSession(), styleUuid, true);
            Map<String, Object> result = call.apply(exactlyIdOf(style));
            Object status = result.get("status");
            styleRepository.updateStatus(style, status instanceof String && !((String) status).isEmpty()
                    ? (String) status : fallbackStatus);
            return success(new JSONObject(result).toString());
        });
    }


    private String exactlyIdOf(JCRNodeWrapper style) throws Exception {
        String exactlyId = styleRepository.getExactlyId(style);
        if (exactlyId == null) {
            throw new IllegalArgumentException("Style not synced with Exactly.ai");
        }
        return exactlyId;
    }

    /** Exactly answers 404 for an unknown model and 422 for an id that is not a UUID. */
    private static boolean isUnknownModel(java.io.IOException e) {
        String message = e.getMessage();
        return message != null && (message.startsWith("API call failed: 404") || message.startsWith("API call failed: 422"));
    }

    private static String descriptionOf(String metadata) {
        if (metadata == null) {
            return null;
        }
        try {
            JSONObject customData = new JSONObject(metadata).optJSONObject("custom_data");
            return customData != null ? customData.optString("description", null) : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String extensionOf(String mimeType) {
        if (mimeType == null) {
            return null;
        }
        switch (mimeType) {
            case "image/png":
                return ".png";
            case "image/jpeg":
                return ".jpg";
            case "image/webp":
                return ".webp";
            default:
                return null;
        }
    }

    private static String truncate(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }
}
