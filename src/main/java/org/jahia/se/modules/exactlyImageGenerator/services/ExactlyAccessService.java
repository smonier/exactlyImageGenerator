package org.jahia.se.modules.exactlyImageGenerator.services;

import org.jahia.api.Constants;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.osgi.service.component.annotations.Component;

import javax.jcr.ItemNotFoundException;
import javax.jcr.PathNotFoundException;
import javax.jcr.RepositoryException;
import java.util.regex.Pattern;

/**
 * Authorization of every Exactly operation, done with the caller's own JCR session.
 * <p>
 * An operation is allowed on a site when the site exists, has this module enabled and the caller
 * holds {@code jContentAccess} on it; operations that change something (on Exactly or in the JCR)
 * also need {@code jcr:write_default} on the node they act on. Nodes the caller names by identifier
 * or path are pinned to their expected type and location. Stateless and thread-safe; the session
 * returned by {@link #userSession()} belongs to the current request thread.
 */
@Component(service = ExactlyAccessService.class)
public class ExactlyAccessService {

    /** Module id, as listed in a site's installed modules. */
    public static final String MODULE_ID = "exactlyImageGenerator";
    /** Folder under {@code /sites/<key>/contents} that holds the style nodes. */
    public static final String STYLES_FOLDER_NAME = "exactly-styles";
    /** Node type of a style. */
    public static final String STYLE_NODE_TYPE = "eximgynt:style";

    static final String PERMISSION_ACCESS = "jContentAccess";
    static final String PERMISSION_WRITE = "jcr:write_default";

    private static final Pattern SITE_KEY = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final Pattern EXTERNAL_ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");

    /** Thrown when the caller may not run an operation; its message is safe to return. */
    public static class AccessDeniedException extends Exception {
        private static final long serialVersionUID = 1L;

        public AccessDeniedException() {
            super("Permission denied");
        }
    }

    /**
     * @return the caller's session on the default (edit) workspace
     * @throws RepositoryException when no session can be opened
     */
    public JCRSessionWrapper userSession() throws RepositoryException {
        return JCRSessionFactory.getInstance().getCurrentUserSession(Constants.EDIT_WORKSPACE);
    }

    /**
     * Resolves a site the caller may use the module on.
     *
     * @param session  the caller's session
     * @param siteKey  key of the site
     * @param forWrite {@code true} when the operation changes something
     * @return the site node
     * @throws AccessDeniedException when the key is invalid, the site is unknown or not readable, the
     *                               module is not enabled on it, or a permission is missing
     * @throws RepositoryException   on a repository error
     */
    public JCRSiteNode requireSite(JCRSessionWrapper session, String siteKey, boolean forWrite)
            throws AccessDeniedException, RepositoryException {
        if (siteKey == null || !SITE_KEY.matcher(siteKey).matches()) {
            throw new AccessDeniedException();
        }
        JCRNodeWrapper node;
        try {
            node = session.getNode("/sites/" + siteKey);
        } catch (PathNotFoundException e) {
            throw new AccessDeniedException();
        }
        if (!(node instanceof JCRSiteNode) || !node.isNodeType("jnt:virtualsite")) {
            throw new AccessDeniedException();
        }
        JCRSiteNode site = (JCRSiteNode) node;
        if (site.getInstalledModules() == null || !site.getInstalledModules().contains(MODULE_ID)
                || !site.hasPermission(PERMISSION_ACCESS)
                || (forWrite && !site.hasPermission(PERMISSION_WRITE))) {
            throw new AccessDeniedException();
        }
        return site;
    }

    /**
     * Resolves a style node the caller may use: of type {@value #STYLE_NODE_TYPE}, directly in the
     * styles folder of a site where {@link #requireSite} passes.
     *
     * @param session   the caller's session
     * @param styleUuid identifier of the style node
     * @param forWrite  {@code true} when the operation changes the style (on Exactly or in the JCR)
     * @return the style node
     * @throws AccessDeniedException when the node is unknown, not readable, of another type or place,
     *                               or a permission is missing
     * @throws RepositoryException   on a repository error
     */
    public JCRNodeWrapper requireStyle(JCRSessionWrapper session, String styleUuid, boolean forWrite)
            throws AccessDeniedException, RepositoryException {
        if (styleUuid == null || styleUuid.isEmpty()) {
            throw new AccessDeniedException();
        }
        JCRNodeWrapper style;
        try {
            style = session.getNodeByIdentifier(styleUuid);
        } catch (ItemNotFoundException | IllegalArgumentException e) {
            throw new AccessDeniedException();
        }
        if (!style.isNodeType(STYLE_NODE_TYPE)) {
            throw new AccessDeniedException();
        }
        JCRSiteNode site = requireSite(session, style.getResolveSite().getSiteKey(), forWrite);
        if (!style.getParent().getPath().equals(stylesFolderPath(site))) {
            throw new AccessDeniedException();
        }
        if (forWrite && !style.hasPermission(PERMISSION_WRITE)) {
            throw new AccessDeniedException();
        }
        return style;
    }

    /**
     * @param site a site
     * @return the path of its styles folder
     */
    public static String stylesFolderPath(JCRSiteNode site) {
        return site.getPath() + "/contents/" + STYLES_FOLDER_NAME;
    }

    /**
     * Validates an identifier that goes into an Exactly API path (model, image or job id).
     *
     * @param id the identifier
     * @return the identifier
     * @throws IllegalArgumentException when it holds anything but letters, digits, {@code _} or {@code -}
     */
    public static String requireExternalId(String id) {
        if (id == null || !EXTERNAL_ID.matcher(id).matches()) {
            throw new IllegalArgumentException("Invalid identifier");
        }
        return id;
    }
}
