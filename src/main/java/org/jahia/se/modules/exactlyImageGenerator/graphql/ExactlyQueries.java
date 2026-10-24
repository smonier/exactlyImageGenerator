package org.jahia.se.modules.exactlyImageGenerator.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLNonNull;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Read-only Exactly fields, under {@code Query.exactly}. Each one checks that the caller may use the
 * module on the site of the style ({@code jContentAccess}). Answers carry the Exactly data as JSON in
 * {@code message}.
 */
@GraphQLName("ExactlyQueries")
@GraphQLDescription("Exactly.ai Image Generator queries")
public class ExactlyQueries extends ExactlyOperations {

    @GraphQLField
    @GraphQLName("configured")
    @GraphQLDescription("Whether the Exactly API token and endpoint are configured; requires access to the site")
    public boolean isConfigured(@GraphQLName("siteKey") @GraphQLNonNull String siteKey) {
        ExactlySyncResponse answer = run("configured", () -> {
            access.requireSite(access.userSession(), siteKey, false);
            return success(null);
        });
        return answer.isSuccessful() && configuration.isConfigured();
    }

    @GraphQLField
    @GraphQLName("trainingImages")
    @GraphQLDescription("Training images of a style on Exactly, as a JSON array in message")
    public ExactlySyncResponse getTrainingImages(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid) {
        return run("trainingImages", () -> {
            String exactlyId = exactlyId(styleUuid);
            if (exactlyId == null) {
                return success("[]");
            }
            return success(new JSONArray(exactlyService.getTrainingImages(exactlyId)).toString());
        });
    }

    @GraphQLField
    @GraphQLName("trainingProgress")
    @GraphQLDescription("Training status and progress of a style, as JSON in message")
    public ExactlySyncResponse getTrainingProgress(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid) {
        return run("trainingProgress", () -> {
            String exactlyId = exactlyId(styleUuid);
            if (exactlyId == null) {
                return success(new JSONObject().put("status", "draft").put("progress", 0).toString());
            }
            return success(new JSONObject(exactlyService.getTrainingProgress(exactlyId)).toString());
        });
    }

    @GraphQLField
    @GraphQLName("model")
    @GraphQLDescription("Details of the Exactly model behind a style, as JSON in message")
    public ExactlySyncResponse getModel(@GraphQLName("styleUuid") @GraphQLNonNull String styleUuid) {
        return run("model", () -> {
            String exactlyId = exactlyId(styleUuid);
            if (exactlyId == null) {
                return failure("Style not synced with Exactly.ai");
            }
            return success(new JSONObject(exactlyService.getModel(exactlyId)).toString());
        });
    }

    private String exactlyId(String styleUuid) throws Exception {
        JCRSessionWrapper session = access.userSession();
        JCRNodeWrapper style = access.requireStyle(session, styleUuid, false);
        return styleRepository.getExactlyId(style);
    }
}
