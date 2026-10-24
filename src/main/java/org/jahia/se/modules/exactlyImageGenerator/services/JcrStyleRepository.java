package org.jahia.se.modules.exactlyImageGenerator.services;

import org.jahia.services.content.JCRContentUtils;
import org.jahia.services.content.JCRNodeIteratorWrapper;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.RepositoryException;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Stores the Exactly styles of a site as {@code eximgynt:style} nodes in
 * {@code /sites/<key>/contents/exactly-styles}.
 * <p>
 * Every method works with the session it is given (the caller's, checked by
 * {@link ExactlyAccessService}) and saves it; nothing here opens a system session. Stateless and
 * thread-safe, but a session must not be shared between threads.
 */
@Component(service = JcrStyleRepository.class)
public class JcrStyleRepository {

    private static final Logger logger = LoggerFactory.getLogger(JcrStyleRepository.class);

    private static final String PROP_EXACTLY_ID = "eximg:exactlyId";
    /** Values the CND choicelist of {@code eximg:status} accepts; anything else Exactly sends is stored as unknown. */
    private static final Set<String> KNOWN_STATUSES = new HashSet<>(Arrays.asList("unknown", "draft", "active", "training", "ready", "failed"));

    /** Values of a style as read from Exactly; {@code null} fields are left unchanged. */
    public static final class StyleData {
        final String exactlyId;
        final String name;
        final String status;
        final Boolean active;
        final String metadata;
        final String description;

        public StyleData(String exactlyId, String name, String status, Boolean active, String metadata, String description) {
            this.exactlyId = exactlyId;
            this.name = name;
            this.status = status;
            this.active = active;
            this.metadata = metadata;
            this.description = description;
        }
    }

    /**
     * Creates or updates the style node of an Exactly model, matched on its Exactly id within the site.
     *
     * @param session the caller's session
     * @param site    the site, already checked
     * @param data    the style values
     * @return the style node
     * @throws RepositoryException when the caller may not write the folder, or on a repository error
     */
    public JCRNodeWrapper saveStyle(JCRSessionWrapper session, JCRSiteNode site, StyleData data) throws RepositoryException {
        ExactlyAccessService.requireExternalId(data.exactlyId);
        JCRNodeWrapper folder = ensureStylesFolder(session, site);
        JCRNodeWrapper style = findByExactlyId(folder, data.exactlyId);
        if (style == null) {
            String nodeName = JCRContentUtils.findAvailableNodeName(folder,
                    JCRContentUtils.generateNodeName(data.name != null ? data.name : data.exactlyId, 32));
            style = folder.addNode(nodeName, ExactlyAccessService.STYLE_NODE_TYPE);
            style.setProperty(PROP_EXACTLY_ID, data.exactlyId);
        }
        apply(style, data);
        session.save();
        logger.debug("Saved style {} (exactlyId {})", style.getPath(), data.exactlyId);
        return style;
    }

    /**
     * @param style a style node
     * @return its Exactly id, validated, or {@code null} when it has none
     * @throws RepositoryException on a repository error
     */
    public String getExactlyId(JCRNodeWrapper style) throws RepositoryException {
        if (!style.hasProperty(PROP_EXACTLY_ID)) {
            return null;
        }
        String id = style.getProperty(PROP_EXACTLY_ID).getString();
        return id.isEmpty() ? null : ExactlyAccessService.requireExternalId(id);
    }

    /**
     * Updates the status of a style.
     *
     * @param style  the style node, already checked for write
     * @param status the new status
     * @throws RepositoryException on a repository error
     */
    public void updateStatus(JCRNodeWrapper style, String status) throws RepositoryException {
        if (status != null && !status.trim().isEmpty()) {
            style.setProperty("eximg:status", normalizeStatus(status));
            style.setProperty("eximg:lastSynced", Calendar.getInstance());
            style.getSession().save();
        }
    }

    /**
     * Removes a style node.
     *
     * @param style the style node, already checked for write
     * @throws RepositoryException on a repository error
     */
    public void deleteStyle(JCRNodeWrapper style) throws RepositoryException {
        JCRSessionWrapper session = style.getSession();
        style.remove();
        session.save();
    }

    private static void apply(JCRNodeWrapper style, StyleData data) throws RepositoryException {
        if (data.name != null) {
            style.setProperty("eximg:name", data.name);
            style.setProperty("jcr:title", data.name);
        }
        if (data.status != null && !data.status.trim().isEmpty()) {
            style.setProperty("eximg:status", normalizeStatus(data.status));
        }
        if (data.active != null) {
            style.setProperty("eximg:active", data.active);
        }
        if (data.metadata != null) {
            style.setProperty("eximg:metadata", data.metadata);
        }
        if (data.description != null) {
            style.setProperty("eximg:description", data.description);
        }
        style.setProperty("eximg:lastSynced", Calendar.getInstance());
    }

    private static String normalizeStatus(String status) {
        String value = status.trim().toLowerCase(Locale.ROOT);
        if ("canceled".equals(value) || "cancelled".equals(value)) {
            return "draft";
        }
        return KNOWN_STATUSES.contains(value) ? value : "unknown";
    }

    /** A site holds a handful of styles: one pass over the folder, no query to build. */
    private static JCRNodeWrapper findByExactlyId(JCRNodeWrapper folder, String exactlyId) throws RepositoryException {
        JCRNodeIteratorWrapper children = folder.getNodes();
        while (children.hasNext()) {
            JCRNodeWrapper child = (JCRNodeWrapper) children.nextNode();
            if (child.isNodeType(ExactlyAccessService.STYLE_NODE_TYPE) && child.hasProperty(PROP_EXACTLY_ID)
                    && exactlyId.equals(child.getProperty(PROP_EXACTLY_ID).getString())) {
                return child;
            }
        }
        return null;
    }

    private static JCRNodeWrapper ensureStylesFolder(JCRSessionWrapper session, JCRSiteNode site) throws RepositoryException {
        String path = ExactlyAccessService.stylesFolderPath(site);
        JCRNodeWrapper folder;
        if (session.nodeExists(path)) {
            folder = session.getNode(path);
        } else {
            JCRNodeWrapper contents = session.getNode(site.getPath() + "/contents");
            folder = contents.addNode(ExactlyAccessService.STYLES_FOLDER_NAME, "jnt:contentFolder");
        }
        if (!folder.isNodeType("eximgmix:exactlyContainer")) {
            folder.addMixin("eximgmix:exactlyContainer");
        }
        return folder;
    }
}
