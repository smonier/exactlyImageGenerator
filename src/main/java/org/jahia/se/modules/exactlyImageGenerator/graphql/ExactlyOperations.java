package org.jahia.se.modules.exactlyImageGenerator.graphql;

import org.jahia.modules.graphql.provider.dxm.DataFetchingException;
import org.jahia.osgi.BundleUtils;
import org.jahia.se.modules.exactlyImageGenerator.cfg.ExactlyConfiguration;
import org.jahia.se.modules.exactlyImageGenerator.services.DamService;
import org.jahia.se.modules.exactlyImageGenerator.services.ExactlyAccessService;
import org.jahia.se.modules.exactlyImageGenerator.services.ExactlyAccessService.AccessDeniedException;
import org.jahia.se.modules.exactlyImageGenerator.services.ExactlyService;
import org.jahia.se.modules.exactlyImageGenerator.services.GeneratedImageRegistry;
import org.jahia.se.modules.exactlyImageGenerator.services.JcrStyleRepository;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Shared plumbing of the {@code exactly} query and mutation fields: service lookup, the error policy,
 * and the conversion of Exactly API errors into short messages.
 * <p>
 * Error policy: a refused authorization is a GraphQL error ({@code Permission denied}, the same for an
 * unknown node and a missing right); an invalid identifier or a failed Exactly call is an answer with
 * {@code successful: false} and a message the UI shows. A new instance is created per request.
 */
abstract class ExactlyOperations {

    private static final Logger logger = LoggerFactory.getLogger(ExactlyOperations.class);

    protected final ExactlyService exactlyService = BundleUtils.getOsgiService(ExactlyService.class, null);
    protected final JcrStyleRepository styleRepository = BundleUtils.getOsgiService(JcrStyleRepository.class, null);
    protected final DamService damService = BundleUtils.getOsgiService(DamService.class, null);
    protected final ExactlyAccessService access = BundleUtils.getOsgiService(ExactlyAccessService.class, null);
    protected final GeneratedImageRegistry generations = BundleUtils.getOsgiService(GeneratedImageRegistry.class, null);
    protected final ExactlyConfiguration configuration = BundleUtils.getOsgiService(ExactlyConfiguration.class, null);

    /** Body of an operation. */
    @FunctionalInterface
    protected interface Operation {
        ExactlySyncResponse run() throws Exception;
    }

    /**
     * Runs an operation with the error policy described on the class.
     *
     * @param name      operation name, for the log
     * @param operation the body
     * @return the answer
     */
    protected ExactlySyncResponse run(String name, Operation operation) {
        try {
            return operation.run();
        } catch (AccessDeniedException e) {
            throw new DataFetchingException(e.getMessage());
        } catch (IllegalArgumentException e) {
            return failure(e.getMessage());
        } catch (Exception e) {
            logger.warn("Exactly operation {} failed: {}", name, e.getMessage());
            logger.debug("Exactly operation {} failed", name, e);
            return failure(extractApiErrorMessage(e.getMessage()));
        }
    }

    protected static ExactlySyncResponse success(String message) {
        return new ExactlySyncResponseImpl(true, message);
    }

    protected static ExactlySyncResponse failure(String message) {
        return new ExactlySyncResponseImpl(false, message);
    }

    /**
     * Turns {@code API call failed: 400 - {"message": "..."}} into the API's own message.
     *
     * @param exceptionMessage message of the caught exception
     * @return a short message for the UI
     */
    static String extractApiErrorMessage(String exceptionMessage) {
        if (exceptionMessage == null) {
            return "An unknown error occurred";
        }
        int jsonStart = exceptionMessage.indexOf('{');
        if (jsonStart >= 0) {
            try {
                String message = new JSONObject(exceptionMessage.substring(jsonStart)).optString("message");
                if (!message.isEmpty()) {
                    return message;
                }
            } catch (Exception e) {
                // not JSON: fall through
            }
        }
        return exceptionMessage;
    }
}
