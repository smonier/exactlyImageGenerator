package org.jahia.se.modules.exactlyImageGenerator.services;

import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.metadata.IIOMetadataNode;
import javax.imageio.stream.ImageInputStream;
import javax.xml.parsers.DocumentBuilderFactory;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/**
 * Runs fixture images of every format the module saves through {@link AiOriginXmp#mark}, then reads
 * the XMP back with a reader that does not share its code (the JDK's ImageIO metadata for PNG and
 * JPEG, a RIFF walk for WebP) and parses it as XML to read {@code Iptc4xmpExt:DigitalSourceType}.
 */
public class AiOriginXmpTest {

    private static final String XMP_NS = "http://ns.adobe.com/xap/1.0/";
    private static final AiOriginXmp.Origin ORIGIN =
            new AiOriginXmp.Origin("Exactly.ai", "3f1c2a9e-0b7d-4c55-9a51-2f6c1d0e8b42", Instant.parse("2026-11-10T09:30:12.345Z"));

    @Test
    public void marksAJpegLikeTheOnesExactlyReturns() throws Exception {
        byte[] original = fixture("exactly-like.jpg");
        byte[] marked = AiOriginXmp.mark(original, "image/jpeg", ORIGIN);

        Document xmp = parse(jpegXmp(marked));
        assertOrigin(xmp);
        assertSamePixels(original, marked);
    }

    @Test
    public void marksAPngWrittenByTheJdk() throws Exception {
        BufferedImage image = new BufferedImage(17, 9, BufferedImage.TYPE_INT_ARGB);
        image.setRGB(3, 4, 0x80ff0000);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(image, "png", png);
        byte[] original = png.toByteArray();
        byte[] marked = AiOriginXmp.mark(original, "image/png", ORIGIN);

        assertOrigin(parse(pngXmp(marked)));
        assertSamePixels(original, marked);
    }

    @Test
    public void addsToAnExistingPngPacketAndKeepsIt() throws Exception {
        byte[] original = fixture("with-xmp.png");
        byte[] marked = AiOriginXmp.mark(original, "image/png", ORIGIN);

        String packet = pngXmp(marked);
        Document xmp = parse(packet);
        assertOrigin(xmp);
        assertTrue("existing title kept", packet.contains("Kept title"));
        assertEquals("one XMP packet", 1, count(new String(marked, StandardCharsets.ISO_8859_1), AiOriginXmp.PNG_XMP_KEYWORD));
        assertSamePixels(original, marked);
    }

    @Test
    public void addsToAnExistingJpegPacketAndKeepsExif() throws Exception {
        byte[] original = fixture("with-xmp.jpg");
        byte[] marked = AiOriginXmp.mark(original, "image/jpeg", ORIGIN);

        String packet = jpegXmp(marked);
        assertOrigin(parse(packet));
        assertTrue("existing title kept", packet.contains("Kept title"));
        String raw = new String(marked, StandardCharsets.ISO_8859_1);
        assertEquals("one XMP segment", 1, count(raw, AiOriginXmp.JPEG_XMP_SIGNATURE));
        assertTrue("Exif kept", raw.contains("Kept artist"));
        assertSamePixels(original, marked);
    }

    @Test
    public void marksALossyWebpAndTurnsItIntoVp8x() throws Exception {
        assertWebp("lossy.webp", false);
    }

    @Test
    public void marksALosslessWebpAndKeepsItsAlphaFlag() throws Exception {
        assertWebp("lossless-alpha.webp", true);
    }

    @Test
    public void marksAnExtendedWebp() throws Exception {
        assertWebp("lossy-alpha.webp", true);
    }

    @Test
    public void keepsADigitalSourceTypeTheGeneratorAlreadyWrote() throws Exception {
        byte[] once = AiOriginXmp.mark(fixture("exactly-like.jpg"), "image/jpeg", ORIGIN);
        byte[] twice = AiOriginXmp.mark(once, "image/jpeg", new AiOriginXmp.Origin("Other", "other", null));
        assertArrayEquals(once, twice);
    }

    @Test
    public void escapesTheModelIdentifier() throws Exception {
        byte[] marked = AiOriginXmp.mark(fixture("exactly-like.jpg"), "image/jpeg",
                new AiOriginXmp.Origin("Exactly.ai", "a<b>&\"c\u0001", null));
        Document xmp = parse(jpegXmp(marked));
        assertEquals("a<b>&\"c", text(xmp, AiOriginXmp.IPTC_EXT_NS, "AISystemVersionUsed"));
        assertEquals(0, xmp.getElementsByTagNameNS(XMP_NS, "CreateDate").getLength());
    }

    @Test
    public void refusesWhatItCannotMark() {
        assertRefused(new byte[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, "image/jpeg");
        assertRefused(new byte[]{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, "image/png");
        assertRefused(new byte[30], "image/webp");
        assertRefused(new byte[30], "image/gif");
        assertRefused(null, "image/png");
    }

    // ---- helpers ----

    private static void assertWebp(String name, boolean alpha) throws Exception {
        byte[] original = fixture(name);
        byte[] marked = AiOriginXmp.mark(original, "image/webp", ORIGIN);

        assertEquals("RIFF", ascii(marked, 0));
        assertEquals("RIFF size", marked.length - 8, le32(marked, 4));
        assertEquals("WEBP", ascii(marked, 8));
        assertEquals("VP8X", ascii(marked, 12));
        int flags = marked[20] & 0xff;
        assertTrue("XMP flag", (flags & 0x04) != 0);
        assertEquals("alpha flag", alpha, (flags & 0x10) != 0);
        int[] size = DamService.webpDimensions(original);
        assertNotNull(size);
        assertArrayEquals("canvas size", size, new int[]{1 + le24(marked, 24), 1 + le24(marked, 27)});

        String xmp = null;
        List<String> chunks = new ArrayList<>();
        int pos = 12;
        while (pos + 8 <= marked.length) {
            String type = ascii(marked, pos);
            int length = le32(marked, pos + 4);
            chunks.add(type);
            if ("XMP ".equals(type)) {
                xmp = new String(marked, pos + 8, length, StandardCharsets.UTF_8);
            }
            pos += 8 + length + (length & 1);
        }
        assertEquals("chunks end at the end of the file", marked.length, pos);
        assertEquals("XMP is the last chunk", "XMP ", chunks.get(chunks.size() - 1));
        assertNotNull(xmp);
        assertOrigin(parse(xmp));
    }

    private static void assertOrigin(Document xmp) {
        assertEquals(AiOriginXmp.TRAINED_ALGORITHMIC_MEDIA, text(xmp, AiOriginXmp.IPTC_EXT_NS, "DigitalSourceType"));
        assertEquals("Exactly.ai", text(xmp, AiOriginXmp.IPTC_EXT_NS, "AISystemUsed"));
        assertEquals("3f1c2a9e-0b7d-4c55-9a51-2f6c1d0e8b42", text(xmp, AiOriginXmp.IPTC_EXT_NS, "AISystemVersionUsed"));
        assertEquals("2026-11-10T09:30:12Z", text(xmp, XMP_NS, "CreateDate"));
    }

    private static void assertRefused(byte[] data, String mimeType) {
        try {
            AiOriginXmp.mark(data, mimeType, ORIGIN);
            fail("Expected " + mimeType + " to be refused");
        } catch (AiOriginXmp.MarkingException expected) {
            // refused
        }
    }

    private static void assertSamePixels(byte[] original, byte[] marked) throws IOException {
        BufferedImage a = ImageIO.read(new ByteArrayInputStream(original));
        BufferedImage b = ImageIO.read(new ByteArrayInputStream(marked));
        assertNotNull("marked image still decodes", b);
        assertEquals(a.getWidth(), b.getWidth());
        assertEquals(a.getHeight(), b.getHeight());
        for (int y = 0; y < a.getHeight(); y++) {
            for (int x = 0; x < a.getWidth(); x++) {
                assertEquals("pixel " + x + "," + y, a.getRGB(x, y), b.getRGB(x, y));
            }
        }
    }

    /** XMP of a JPEG, read from the JDK's native metadata (APP1 segments are "unknown" markers). */
    private static String jpegXmp(byte[] jpeg) throws IOException {
        IIOMetadataNode root = (IIOMetadataNode) metadata(jpeg).getAsTree("javax_imageio_jpeg_image_1.0");
        NodeList unknown = root.getElementsByTagName("unknown");
        for (int i = 0; i < unknown.getLength(); i++) {
            IIOMetadataNode node = (IIOMetadataNode) unknown.item(i);
            byte[] data = (byte[]) node.getUserObject();
            String signature = AiOriginXmp.JPEG_XMP_SIGNATURE;
            if ("225".equals(node.getAttribute("MarkerTag"))
                    && new String(data, 0, Math.min(data.length, signature.length()), StandardCharsets.US_ASCII).equals(signature)) {
                return new String(data, signature.length(), data.length - signature.length(), StandardCharsets.UTF_8);
            }
        }
        throw new AssertionError("No XMP segment in the JPEG");
    }

    /** XMP of a PNG, read from the JDK's native PNG metadata. */
    private static String pngXmp(byte[] png) throws IOException {
        IIOMetadataNode root = (IIOMetadataNode) metadata(png).getAsTree("javax_imageio_png_1.0");
        NodeList entries = root.getElementsByTagName("iTXtEntry");
        for (int i = 0; i < entries.getLength(); i++) {
            IIOMetadataNode entry = (IIOMetadataNode) entries.item(i);
            if (AiOriginXmp.PNG_XMP_KEYWORD.equals(entry.getAttribute("keyword"))) {
                assertEquals("uncompressed", "FALSE", entry.getAttribute("compressionFlag"));
                return entry.getAttribute("text");
            }
        }
        throw new AssertionError("No XMP iTXt chunk in the PNG");
    }

    private static IIOMetadata metadata(byte[] data) throws IOException {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                IIOImage image = reader.readAll(0, null);
                return image.getMetadata();
            } finally {
                reader.dispose();
            }
        }
    }

    private static Document parse(String xmp) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xmp.getBytes(StandardCharsets.UTF_8)));
    }

    private static String text(Document xmp, String namespace, String localName) {
        NodeList nodes = xmp.getElementsByTagNameNS(namespace, localName);
        assertEquals("one " + localName, 1, nodes.getLength());
        return nodes.item(0).getTextContent();
    }

    private static byte[] fixture(String name) throws IOException {
        try (InputStream in = AiOriginXmpTest.class.getResourceAsStream("/fixtures/" + name)) {
            assertNotNull(name, in);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = in.read(buffer)) > 0) {
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    private static int count(String haystack, String needle) {
        int count = 0;
        for (int i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + 1)) {
            count++;
        }
        return count;
    }

    private static String ascii(byte[] d, int offset) {
        return new String(d, offset, 4, StandardCharsets.US_ASCII);
    }

    private static int le32(byte[] d, int offset) {
        return (d[offset] & 0xff) | (d[offset + 1] & 0xff) << 8 | (d[offset + 2] & 0xff) << 16 | (d[offset + 3] & 0xff) << 24;
    }

    private static int le24(byte[] d, int offset) {
        return (d[offset] & 0xff) | (d[offset + 1] & 0xff) << 8 | (d[offset + 2] & 0xff) << 16;
    }
}
