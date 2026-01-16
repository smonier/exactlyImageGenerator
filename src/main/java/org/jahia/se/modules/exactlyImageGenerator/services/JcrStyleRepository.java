package org.jahia.se.modules.exactlyImageGenerator.services;

import org.jahia.services.content.*;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.Node;
import javax.jcr.NodeIterator;
import javax.jcr.RepositoryException;
import javax.jcr.query.Query;
import javax.jcr.query.QueryManager;
import javax.jcr.query.QueryResult;
import java.util.*;

/**
 * Repository service for managing eximgynt:style nodes
 */
@Component(service = JcrStyleRepository.class, immediate = true)
public class JcrStyleRepository {
    
    private static final Logger logger = LoggerFactory.getLogger(JcrStyleRepository.class);
    
    private static final String STYLE_NODE_TYPE = "eximgynt:style";
    private static final String STYLES_FOLDER_NAME = "exactly-styles";
    
    @Reference
    private JCRStoreService jcrStoreService;
    
    /**
     * Find or create style node by Exactly ID
     */
    public Node findOrCreateStyle(String siteKey, String exactlyId, String name, String status, Boolean active, String metadata, String description) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            // Validate inputs
            if (exactlyId == null || exactlyId.trim().isEmpty()) {
                logger.error("Cannot create/update style with null or empty exactlyId");
                throw new RepositoryException("exactlyId is required");
            }
            
            // Ensure folder exists
            Node stylesFolder = ensureStylesFolder(session, siteKey);
            
            // Search for existing style
            Node existingStyle = findStyleByExactlyId(session, siteKey, exactlyId);
            if (existingStyle != null) {
                // Update existing style
                if (name != null) {
                    existingStyle.setProperty("eximg:name", name);
                    existingStyle.setProperty("jcr:title", name);
                }
                if (status != null && !status.trim().isEmpty()) {
                    existingStyle.setProperty("eximg:status", status);
                }
                if (active != null) {
                    existingStyle.setProperty("eximg:active", active);
                }
                if (metadata != null) {
                    existingStyle.setProperty("eximg:metadata", metadata);
                }
                if (description != null) {
                    existingStyle.setProperty("eximg:description", description);
                }
                existingStyle.setProperty("eximg:lastSynced", Calendar.getInstance());
                session.save();
                logger.info("Updated style node: {} (exactlyId: {})", existingStyle.getPath(), exactlyId);
                return existingStyle;
            }
            
            // Create new style
            String nodeName = JCRContentUtils.generateNodeName(name != null ? name : exactlyId, 32);
            
            // Check if node with this name already exists
            if (stylesFolder.hasNode(nodeName)) {
                Node existingNode = stylesFolder.getNode(nodeName);
                // Update the existing node with the new exactlyId and data
                existingNode.setProperty("eximg:exactlyId", exactlyId);
                if (name != null) {
                    existingNode.setProperty("eximg:name", name);
                    existingNode.setProperty("jcr:title", name);
                }
                if (status != null && !status.trim().isEmpty()) {
                    existingNode.setProperty("eximg:status", status);
                }
                if (active != null) {
                    existingNode.setProperty("eximg:active", active);
                }
                if (metadata != null) {
                    existingNode.setProperty("eximg:metadata", metadata);
                }
                if (description != null) {
                    existingNode.setProperty("eximg:description", description);
                }
                existingNode.setProperty("eximg:lastSynced", Calendar.getInstance());
                session.save();
                logger.info("Updated existing node by name: {} (exactlyId: {})", existingNode.getPath(), exactlyId);
                return existingNode;
            }
            
            // Create new node
            Node styleNode = stylesFolder.addNode(nodeName, STYLE_NODE_TYPE);
            styleNode.setProperty("eximg:exactlyId", exactlyId);
            if (name != null) {
                styleNode.setProperty("eximg:name", name);
                styleNode.setProperty("jcr:title", name);
            }
            if (status != null && !status.trim().isEmpty()) {
                styleNode.setProperty("eximg:status", status);
            }
            if (active != null) {
                styleNode.setProperty("eximg:active", active);
            }
            if (metadata != null) {
                styleNode.setProperty("eximg:metadata", metadata);
            }
            if (description != null) {
                styleNode.setProperty("eximg:description", description);
            }
            styleNode.setProperty("eximg:lastSynced", Calendar.getInstance());
            
            session.save();
            logger.info("Created style node: {} (exactlyId: {})", styleNode.getPath(), exactlyId);
            return styleNode;
        });
    }
    
    /**
     * Update style node
     */
    public Node updateStyle(String uuid, String name, String status, Boolean active, String metadata, String description) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node styleNode = session.getNodeByIdentifier(uuid);
            
            if (name != null) {
                styleNode.setProperty("eximg:name", name);
            }
            if (status != null) {
                styleNode.setProperty("eximg:status", status);
            }
            if (active != null) {
                styleNode.setProperty("eximg:active", active);
            }
            if (metadata != null) {
                styleNode.setProperty("eximg:metadata", metadata);
            }
            if (description != null) {
                styleNode.setProperty("eximg:description", description);
            }
            styleNode.setProperty("eximg:lastSynced", Calendar.getInstance());
            
            session.save();
            logger.info("Updated style node: {}", styleNode.getPath());
            return styleNode;
        });
    }
    
    /**
     * Get style by UUID
     */
    public Node getStyleByUuid(String uuid) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            return session.getNodeByIdentifier(uuid);
        });
    }
    
    /**
     * Get Exactly ID from style node
     */
    public String getExactlyId(String uuid) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node styleNode = session.getNodeByIdentifier(uuid);
            return styleNode.hasProperty("eximg:exactlyId") ? 
                   styleNode.getProperty("eximg:exactlyId").getString() : null;
        });
    }
    
    /**
     * Delete style node
     */
    public void deleteStyle(String uuid) throws RepositoryException {
        JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node styleNode = session.getNodeByIdentifier(uuid);
            String path = styleNode.getPath();
            styleNode.remove();
            session.save();
            logger.info("Deleted style node: {}", path);
            return null;
        });
    }
    
    /**
     * List all styles
     */
    public List<Node> listAllStyles(String siteKey) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            List<Node> styles = new ArrayList<>();
            Node stylesFolder = ensureStylesFolder(session, siteKey);
            
            NodeIterator nodes = stylesFolder.getNodes();
            while (nodes.hasNext()) {
                Node node = nodes.nextNode();
                if (node.isNodeType(STYLE_NODE_TYPE)) {
                    styles.add(node);
                }
            }
            
            return styles;
        });
    }
    
    private String getStylesFolderPath(String siteKey) {
        return "/sites/" + siteKey + "/contents/" + STYLES_FOLDER_NAME;
    }
    
    private Node findStyleByExactlyId(JCRSessionWrapper session, String siteKey, String exactlyId) throws RepositoryException {
        QueryManager queryManager = session.getWorkspace().getQueryManager();
        String queryString = "SELECT * FROM [eximgynt:style] WHERE [eximg:exactlyId] = '" + exactlyId + "'";
        Query query = queryManager.createQuery(queryString, Query.JCR_SQL2);
        QueryResult result = query.execute();
        
        NodeIterator nodes = result.getNodes();
        if (nodes.hasNext()) {
            return nodes.nextNode();
        }
        return null;
    }
    
    private Node ensureStylesFolder(JCRSessionWrapper session, String siteKey) throws RepositoryException {
        String stylesFolderPath = getStylesFolderPath(siteKey);
        if (!session.nodeExists(stylesFolderPath)) {
            String[] pathParts = stylesFolderPath.substring(1).split("/");
            Node current = session.getNode("/");
            
            for (String part : pathParts) {
                if (!current.hasNode(part)) {
                    current = current.addNode(part, "jnt:contentFolder");
                } else {
                    current = current.getNode(part);
                }
            }
            session.save();
        }
        Node folder = session.getNode(stylesFolderPath);
        
        // Add mixin to allow eximgynt:style children
        if (!folder.isNodeType("eximgmix:exactlyContainer")) {
            folder.addMixin("eximgmix:exactlyContainer");
            session.save();
        }
        
        return folder;
    }
}
