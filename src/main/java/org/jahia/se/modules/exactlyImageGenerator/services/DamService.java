package org.jahia.se.modules.exactlyImageGenerator.services;

import org.apache.commons.io.IOUtils;
import org.jahia.services.content.JCRContentUtils;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.se.modules.exactlyImageGenerator.services.ExactlyAccessService.AccessDeniedException;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.jcr.Binary;
import javax.jcr.ItemNotFoundException;
import javax.jcr.RepositoryException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;

/**
 * Reads images from and writes images to a site's media library (DAM), always with the caller's own
 * session: a caller can only send images they can read and only save into folders they can write.
 * Every node is pinned to its type and to the site's {@code files} tree. Stateless and thread-safe.
 */
@Component(service = DamService.class)
public class DamService {

    private static final Logger logger = LoggerFactory.getLogger(DamService.class);

    /** Shortest side Exactly.ai accepts for a training image (px). */
    public static final int MIN_TRAINING_IMAGE_SIDE = 1024;
    /** Largest DAM image the module sends to Exactly (bytes). */
    static final long MAX_TRAINING_IMAGE_BYTES = 20L * 1024 * 1024;
    /** Folder created under the site's files when the caller picks no folder. */
    public static final String DEFAULT_FOLDER_NAME = "exactly-generated";

    /** An image read from the DAM. */
    public static final class DamImage {
        private final String name;
        private final byte[] data;

        DamImage(String name, byte[] data) {
            this.name = name;
            this.data = data;
        }

        public String getName() {
            return name;
        }

        public byte[] getData() {
            return data;
        }
    }

    /**
     * Reads an image of the media library with the caller's session, so only a file the caller may
     * read is ever returned. Any site's files qualify (shared media, another site's library), as in
     * jContent's picker.
     *
     * @param session   the caller's session
     * @param assetUuid identifier of a {@code jnt:file} with an image type
     * @return the file name and content
     * @throws AccessDeniedException     when the node is unknown or unreadable by the caller
     * @throws IllegalArgumentException  when it is not an image file or is larger than
     *                                   {@value #MAX_TRAINING_IMAGE_BYTES} bytes, or smaller than
     *                                   {@value #MIN_TRAINING_IMAGE_SIDE} px on its shortest side (the message names the file)
     * @throws RepositoryException       on a repository error
     * @throws IOException               when the binary cannot be read
     */
    public DamImage readImage(JCRSessionWrapper session, String assetUuid)
            throws AccessDeniedException, RepositoryException, IOException {
        JCRNodeWrapper file;
        try {
            file = session.getNodeByIdentifier(assetUuid);
        } catch (ItemNotFoundException | IllegalArgumentException e) {
            throw new AccessDeniedException();
        }
        String name = file.getName();
        if (!file.isNodeType("jnt:file") || !file.hasNode("jcr:content")) {
            throw new IllegalArgumentException(name + " is not a file of the media library");
        }
        JCRNodeWrapper content = file.getNode("jcr:content");
        String mimeType = content.hasProperty("jcr:mimeType") ? content.getProperty("jcr:mimeType").getString() : "";
        if (!mimeType.startsWith("image/")) {
            throw new IllegalArgumentException(name + " is not an image");
        }
        Binary binary = content.getProperty("jcr:data").getBinary();
        try {
            if (binary.getSize() > MAX_TRAINING_IMAGE_BYTES) {
                throw new IllegalArgumentException(name + " is larger than " + (MAX_TRAINING_IMAGE_BYTES / (1024 * 1024)) + " MB");
            }
            byte[] data;
            try (InputStream in = binary.getStream()) {
                data = IOUtils.toByteArray(in);
            }
            int[] size = dimensions(file, data);
            if (size != null && Math.min(size[0], size[1]) < MIN_TRAINING_IMAGE_SIDE) {
                throw new IllegalArgumentException(name + " is " + size[0] + " x " + size[1]
                        + " px, Exactly.ai needs at least " + MIN_TRAINING_IMAGE_SIDE + " px on the shortest side");
            }
            return new DamImage(name, data);
        } finally {
            binary.dispose();
        }
    }

    /**
     * Width and height of an image: Jahia's {@code j:width}/{@code j:height} when the file has them,
     * else read from the image itself (JPEG, PNG, GIF, BMP through the JDK, WebP from its header).
     *
     * @return {width, height}, or {@code null} when the size cannot be read (Exactly.ai then decides)
     */
    static int[] dimensions(JCRNodeWrapper file, byte[] data) throws RepositoryException {
        if (file.hasProperty("j:width") && file.hasProperty("j:height")) {
            return new int[]{(int) file.getProperty("j:width").getLong(), (int) file.getProperty("j:height").getLong()};
        }
        int[] webp = webpDimensions(data);
        if (webp != null) {
            return webp;
        }
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = in != null ? ImageIO.getImageReaders(in) : null;
            if (readers != null && readers.hasNext()) {
                ImageReader reader = readers.next();
                try {
                    reader.setInput(in);
                    return new int[]{reader.getWidth(0), reader.getHeight(0)};
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException e) {
            logger.debug("Cannot read the size of {}", file.getPath(), e);
        }
        return null;
    }

    /** Size from a WebP header (RIFF/WEBP with a VP8, VP8L or VP8X chunk), or {@code null}. */
    static int[] webpDimensions(byte[] d) {
        if (d.length < 30 || !"RIFF".equals(ascii(d, 0)) || !"WEBP".equals(ascii(d, 8))) {
            return null;
        }
        String chunk = ascii(d, 12);
        switch (chunk) {
            case "VP8X":
                return new int[]{1 + u24(d, 24), 1 + u24(d, 27)};
            case "VP8L":
                int bits = (d[21] & 0xff) | (d[22] & 0xff) << 8 | (d[23] & 0xff) << 16 | (d[24] & 0xff) << 24;
                return new int[]{1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)};
            case "VP8 ":
                return new int[]{u16(d, 26) & 0x3fff, u16(d, 28) & 0x3fff};
            default:
                return null;
        }
    }

    private static String ascii(byte[] d, int offset) {
        return new String(d, offset, 4, java.nio.charset.StandardCharsets.US_ASCII);
    }

    private static int u16(byte[] d, int offset) {
        return (d[offset] & 0xff) | (d[offset + 1] & 0xff) << 8;
    }

    private static int u24(byte[] d, int offset) {
        return (d[offset] & 0xff) | (d[offset + 1] & 0xff) << 8 | (d[offset + 2] & 0xff) << 16;
    }

    /**
     * Resolves the folder generated images go to: the given path, which must be a folder of the site's
     * files, or {@code <site>/files/exactly-generated} (created when missing) when no path is given.
     *
     * @param session    the caller's session
     * @param site       the site, already checked
     * @param folderPath a folder path, or {@code null}
     * @return the folder
     * @throws AccessDeniedException when the path is outside the site's files, not a folder, or not writable
     * @throws RepositoryException   on a repository error
     */
    public JCRNodeWrapper resolveTargetFolder(JCRSessionWrapper session, JCRSiteNode site, String folderPath)
            throws AccessDeniedException, RepositoryException {
        String filesPath = site.getPath() + "/files";
        JCRNodeWrapper folder;
        if (folderPath == null || folderPath.trim().isEmpty()) {
            JCRNodeWrapper files = session.getNode(filesPath);
            folder = files.hasNode(DEFAULT_FOLDER_NAME) ? files.getNode(DEFAULT_FOLDER_NAME)
                    : files.addNode(DEFAULT_FOLDER_NAME, "jnt:folder");
        } else {
            String path = folderPath.trim();
            if (path.contains("..") || !(path.equals(filesPath) || path.startsWith(filesPath + "/"))
                    || !session.nodeExists(path)) {
                throw new AccessDeniedException();
            }
            folder = session.getNode(path);
        }
        if (!folder.isNodeType("jnt:folder") || !folder.hasPermission(ExactlyAccessService.PERMISSION_WRITE)) {
            throw new AccessDeniedException();
        }
        return folder;
    }

    /**
     * Creates an image file in a folder; the session is saved by the caller once all files are added.
     *
     * @param folder   the target folder, already checked
     * @param fileName wanted file name (made unique in the folder)
     * @param mimeType media type of the image
     * @param data     image content
     * @param title    title of the file, or {@code null}
     * @return the created file node
     * @throws RepositoryException on a repository error
     */
    public JCRNodeWrapper createImage(JCRNodeWrapper folder, String fileName, String mimeType, byte[] data, String title)
            throws RepositoryException {
        String name = JCRContentUtils.findAvailableNodeName(folder, JCRContentUtils.escapeLocalNodeName(fileName));
        JCRNodeWrapper file = folder.uploadFile(name, new ByteArrayInputStream(data), mimeType);
        if (title != null && !title.isEmpty()) {
            file.setProperty("jcr:title", title);
        }
        logger.debug("Created DAM image {}", file.getPath());
        return file;
    }
}
