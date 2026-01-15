package org.jahia.se.modules.exactlyImageGenerator.services;

import org.apache.commons.io.IOUtils;
import org.jahia.services.content.*;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.Node;
import javax.jcr.RepositoryException;
import javax.jcr.Binary;
import java.io.InputStream;
import java.util.Calendar;

/**
 * Service for DAM operations - reading and creating assets
 */
@Component(service = DamService.class, immediate = true)
public class DamService {
    
    private static final Logger logger = LoggerFactory.getLogger(DamService.class);
    
    @Reference
    private JCRStoreService jcrStoreService;
    
    /**
     * Get binary stream from DAM asset by UUID
     */
    public InputStream getDamAssetStream(String assetUuid) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node assetNode = session.getNodeByIdentifier(assetUuid);
            
            if (!assetNode.isNodeType("jnt:file")) {
                throw new RepositoryException("Node is not a file: " + assetNode.getPath());
            }
            
            Node contentNode = assetNode.getNode("jcr:content");
            Binary binary = contentNode.getProperty("jcr:data").getBinary();
            
            return binary.getStream();
        });
    }
    
    /**
     * Get file name from DAM asset
     */
    public String getDamAssetName(String assetUuid) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node assetNode = session.getNodeByIdentifier(assetUuid);
            return assetNode.getName();
        });
    }
    
    /**
     * Get mime type from DAM asset
     */
    public String getDamAssetMimeType(String assetUuid) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node assetNode = session.getNodeByIdentifier(assetUuid);
            
            if (assetNode.isNodeType("jnt:file") && assetNode.hasNode("jcr:content")) {
                Node contentNode = assetNode.getNode("jcr:content");
                if (contentNode.hasProperty("jcr:mimeType")) {
                    return contentNode.getProperty("jcr:mimeType").getString();
                }
            }
            
            return "application/octet-stream";
        });
    }
    
    /**
     * Create DAM asset from input stream
     * 
     * @param targetFolderPath DAM folder path (e.g., /sites/digitall/files/images)
     * @param fileName File name for the new asset
     * @param mimeType MIME type
     * @param inputStream Binary data
     * @param title Optional title
     * @return Created asset node
     */
    public Node createDamAsset(String targetFolderPath, String fileName, String mimeType, 
                               InputStream inputStream, String title) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            // Get or create target folder
            Node targetFolder = getOrCreateFolder(session, targetFolderPath);
            
            // Generate unique file name if needed
            String uniqueFileName = generateUniqueFileName(targetFolder, fileName);
            
            // Create jnt:file node
            Node fileNode = targetFolder.addNode(uniqueFileName, "jnt:file");
            
            // Create jcr:content node
            Node contentNode = fileNode.addNode("jcr:content", "jnt:resource");
            
            try {
                // Set binary data
                Binary binary = session.getValueFactory().createBinary(inputStream);
                contentNode.setProperty("jcr:data", binary);
                
                // Set mime type
                if (mimeType != null && !mimeType.isEmpty()) {
                    contentNode.setProperty("jcr:mimeType", mimeType);
                } else {
                    contentNode.setProperty("jcr:mimeType", "image/png");
                }
                
                // Set last modified
                contentNode.setProperty("jcr:lastModified", Calendar.getInstance());
                
                // Set title if provided
                if (title != null && !title.isEmpty()) {
                    fileNode.setProperty("jcr:title", title);
                }
                
                session.save();
                logger.info("Created DAM asset: {}", fileNode.getPath());
                
                return fileNode;
            } finally {
                IOUtils.closeQuietly(inputStream);
            }
        });
    }
    
    /**
     * Create DAM asset from input stream by folder UUID
     */
    public Node createDamAssetByFolderUuid(String targetFolderUuid, String fileName, String mimeType,
                                           InputStream inputStream, String title) throws RepositoryException {
        return JCRTemplate.getInstance().doExecuteWithSystemSession(session -> {
            Node targetFolder = session.getNodeByIdentifier(targetFolderUuid);
            String folderPath = targetFolder.getPath();
            
            // Delegate to path-based method
            return createDamAsset(folderPath, fileName, mimeType, inputStream, title);
        });
    }
    
    /**
     * Ensure folder exists, create if needed
     */
    private Node getOrCreateFolder(JCRSessionWrapper session, String folderPath) throws RepositoryException {
        if (session.nodeExists(folderPath)) {
            return session.getNode(folderPath);
        }
        
        // Create parent folders recursively
        String[] parts = folderPath.substring(1).split("/");
        Node current = session.getNode("/");
        
        for (String part : parts) {
            if (!current.hasNode(part)) {
                current = current.addNode(part, "jnt:folder");
            } else {
                current = current.getNode(part);
            }
        }
        
        session.save();
        return current;
    }
    
    /**
     * Generate unique file name if file already exists
     */
    private String generateUniqueFileName(Node folder, String fileName) throws RepositoryException {
        if (!folder.hasNode(fileName)) {
            return fileName;
        }
        
        String baseName = fileName;
        String extension = "";
        
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0) {
            baseName = fileName.substring(0, dotIndex);
            extension = fileName.substring(dotIndex);
        }
        
        int counter = 1;
        String uniqueName;
        do {
            uniqueName = baseName + "_" + counter + extension;
            counter++;
        } while (folder.hasNode(uniqueName));
        
        return uniqueName;
    }
}
