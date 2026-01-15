package org.jahia.se.modules.exactlyImageGenerator.services;

import org.jahia.services.content.*;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.Node;
import javax.jcr.RepositoryException;
import java.util.*;

/**
 * Repository service for managing eximg:project nodes
 */
@Component(service = JcrProjectRepository.class, immediate = true)
public class JcrProjectRepository {
    
    private static final Logger logger = LoggerFactory.getLogger(JcrProjectRepository.class);
    
    private static final String PROJECT_NODE_TYPE = "eximg:project";
    private static final String PROJECTS_FOLDER_NAME = "exactly-projects";
    
    @Reference
    private JCRStoreService jcrStoreService;
    
    /**
     * Create a new project node
     */
    public Node createProject(String siteKey, String type, String styleUuid, String prompt, String paramsJson) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node projectsFolder = ensureProjectsFolder(session, siteKey);
            
            String nodeName = JCRContentUtils.generateNodeName("project-" + System.currentTimeMillis(), 32);
            Node projectNode = projectsFolder.addNode(nodeName, PROJECT_NODE_TYPE);
            
            projectNode.setProperty("eximg:type", type);
            projectNode.setProperty("eximg:status", "pending");
            
            if (styleUuid != null) {
                projectNode.setProperty("eximg:styleUuid", styleUuid);
            }
            if (prompt != null) {
                projectNode.setProperty("eximg:prompt", prompt);
            }
            if (paramsJson != null) {
                projectNode.setProperty("eximg:paramsJson", paramsJson);
            }
            
            Calendar now = Calendar.getInstance();
            projectNode.setProperty("eximg:createdAt", now);
            projectNode.setProperty("eximg:updatedAt", now);
            
            session.save();
            logger.info("Created project node: {} (type: {})", projectNode.getPath(), type);
            return projectNode;
        });
    }
    
    /**
     * Update project status
     */
    public Node updateProjectStatus(String uuid, String status, String metadata) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node projectNode = session.getNodeByIdentifier(uuid);
            
            projectNode.setProperty("eximg:status", status);
            if (metadata != null) {
                projectNode.setProperty("eximg:metadata", metadata);
            }
            projectNode.setProperty("eximg:updatedAt", Calendar.getInstance());
            
            session.save();
            logger.info("Updated project status: {} -> {}", projectNode.getPath(), status);
            return projectNode;
        });
    }
    
    /**
     * Store generated image URLs
     */
    public Node storeGeneratedUrls(String uuid, List<String> urls) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node projectNode = session.getNodeByIdentifier(uuid);
            
            String[] urlArray = urls.toArray(new String[0]);
            projectNode.setProperty("eximg:generatedRemoteUrls", urlArray);
            projectNode.setProperty("eximg:updatedAt", Calendar.getInstance());
            
            session.save();
            logger.info("Stored {} generated URLs for project: {}", urls.size(), projectNode.getPath());
            return projectNode;
        });
    }
    
    /**
     * Link generated DAM assets to project
     */
    public Node linkGeneratedAssets(String uuid, List<String> assetUuids) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node projectNode = session.getNodeByIdentifier(uuid);
            
            // Get existing assets
            Set<String> existingAssets = new HashSet<>();
            if (projectNode.hasProperty("eximg:generatedAssetUuids")) {
                for (javax.jcr.Value value : projectNode.getProperty("eximg:generatedAssetUuids").getValues()) {
                    existingAssets.add(value.getString());
                }
            }
            
            // Add new assets
            existingAssets.addAll(assetUuids);
            
            String[] assetArray = existingAssets.toArray(new String[0]);
            projectNode.setProperty("eximg:generatedAssetUuids", assetArray);
            projectNode.setProperty("eximg:updatedAt", Calendar.getInstance());
            
            session.save();
            logger.info("Linked {} assets to project: {}", assetUuids.size(), projectNode.getPath());
            return projectNode;
        });
    }
    
    /**
     * Set remote job ID
     */
    public Node setRemoteJobId(String uuid, String remoteJobId) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node projectNode = session.getNodeByIdentifier(uuid);
            
            projectNode.setProperty("eximg:remoteJobId", remoteJobId);
            projectNode.setProperty("eximg:updatedAt", Calendar.getInstance());
            
            session.save();
            return projectNode;
        });
    }
    
    /**
     * Get project by UUID
     */
    public Node getProjectByUuid(String uuid) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            return session.getNodeByIdentifier(uuid);
        });
    }
    
    private String getProjectsFolderPath(String siteKey) {
        return "/sites/" + siteKey + "/contents/" + PROJECTS_FOLDER_NAME;
    }
    
    private Node ensureProjectsFolder(JCRSessionWrapper session, String siteKey) throws RepositoryException {
        String projectsFolderPath = getProjectsFolderPath(siteKey);
        if (!session.nodeExists(projectsFolderPath)) {
            String[] pathParts = projectsFolderPath.substring(1).split("/");
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
        return session.getNode(projectsFolderPath);
    }
}
