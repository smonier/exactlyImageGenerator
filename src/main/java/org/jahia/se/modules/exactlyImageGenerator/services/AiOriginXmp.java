package org.jahia.se.modules.exactlyImageGenerator.services;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.zip.CRC32;

/**
 * Marks an image a model generated as such, in XMP metadata a program can read (EU AI Act Article
 * 50(2)): {@code Iptc4xmpExt:DigitalSourceType} set to the IPTC term
 * {@value #TRAINED_ALGORITHMIC_MEDIA}, with the AI system ({@code Iptc4xmpExt:AISystemUsed}), the
 * model ({@code Iptc4xmpExt:AISystemVersionUsed}) and the time of the generation
 * ({@code xmp:CreateDate}).
 * <p>
 * The packet is written into the file itself, so the mark travels with the image wherever it is
 * published: a PNG {@code iTXt} chunk with the keyword {@code XML:com.adobe.xmp}, a JPEG {@code APP1}
 * segment with the {@code http://ns.adobe.com/xap/1.0/} signature, a WebP {@code XMP } chunk (a simple
 * WebP is turned into the extended format, {@code VP8X}, which XMP needs). Pixels are never decoded or
 * re-encoded. An image that already carries an XMP packet keeps it: the mark is added to it as one more
 * {@code rdf:Description}, unless the packet already states a digital source type, which is then kept
 * as the generator wrote it.
 * <p>
 * Stateless and thread-safe.
 */
public final class AiOriginXmp {

    /** IPTC Digital Source Type of content created by a trained model. */
    public static final String TRAINED_ALGORITHMIC_MEDIA =
            "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";
    /** Namespace of the IPTC Extension XMP schema. */
    public static final String IPTC_EXT_NS = "http://iptc.org/std/Iptc4xmpExt/2008-02-29/";

    static final String PNG_XMP_KEYWORD = "XML:com.adobe.xmp";
    static final String JPEG_XMP_SIGNATURE = "http://ns.adobe.com/xap/1.0/\0";
    /** Largest XMP packet a single JPEG APP1 segment holds (65535 - 2 length bytes - 29 signature bytes). */
    static final int JPEG_MAX_XMP = 65_504;

    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'};
    private static final String RDF_CLOSE = "</rdf:RDF>";

    /** Who and what generated the image. */
    public static final class Origin {
        private final String aiSystem;
        private final String model;
        private final Instant generatedAt;

        /**
         * @param aiSystem    name of the AI system (provider), or {@code null}
         * @param model       identifier of the model that generated the image, or {@code null}
         * @param generatedAt when the image was generated, or {@code null}
         */
        public Origin(String aiSystem, String model, Instant generatedAt) {
            this.aiSystem = aiSystem;
            this.model = model;
            this.generatedAt = generatedAt;
        }
    }

    /** The image cannot be marked (unknown format, damaged file, packet too large). */
    public static class MarkingException extends Exception {
        private static final long serialVersionUID = 1L;

        MarkingException(String message) {
            super(message);
        }
    }

    private AiOriginXmp() {
    }

    /**
     * Returns a copy of the image carrying the AI-origin XMP.
     *
     * @param data     the image as generated
     * @param mimeType {@code image/png}, {@code image/jpeg} or {@code image/webp}
     * @param origin   who and what generated it
     * @return the marked image
     * @throws MarkingException when the type is not one of the three, the bytes do not match it, or the
     *                          JPEG packet would exceed one segment; the caller must not store the
     *                          image unmarked
     */
    public static byte[] mark(byte[] data, String mimeType, Origin origin) throws MarkingException {
        if (data == null || mimeType == null) {
            throw new MarkingException("No image to mark");
        }
        switch (mimeType) {
            case "image/png":
                return markPng(data, origin);
            case "image/jpeg":
                return markJpeg(data, origin);
            case "image/webp":
                return markWebp(data, origin);
            default:
                throw new MarkingException("Cannot write XMP into " + mimeType);
        }
    }

    /** The XMP packet written into an image that has none. */
    static String packet(Origin origin) {
        return "<?xpacket begin=\"﻿\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n"
                + "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n"
                + "<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n"
                + description(origin)
                + RDF_CLOSE + "\n"
                + "</x:xmpmeta>\n"
                + "<?xpacket end=\"w\"?>";
    }

    private static String description(Origin origin) {
        StringBuilder sb = new StringBuilder();
        sb.append("<rdf:Description rdf:about=\"\" xmlns:Iptc4xmpExt=\"").append(IPTC_EXT_NS)
                .append("\" xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\">\n");
        sb.append("<Iptc4xmpExt:DigitalSourceType>").append(TRAINED_ALGORITHMIC_MEDIA)
                .append("</Iptc4xmpExt:DigitalSourceType>\n");
        element(sb, "Iptc4xmpExt:AISystemUsed", origin != null ? origin.aiSystem : null);
        element(sb, "Iptc4xmpExt:AISystemVersionUsed", origin != null ? origin.model : null);
        if (origin != null && origin.generatedAt != null) {
            element(sb, "xmp:CreateDate", origin.generatedAt.truncatedTo(ChronoUnit.SECONDS).toString());
        }
        sb.append("</rdf:Description>\n");
        return sb.toString();
    }

    private static void element(StringBuilder sb, String name, String value) {
        if (value != null && !value.trim().isEmpty()) {
            sb.append('<').append(name).append('>').append(escape(value.trim())).append("</").append(name).append(">\n");
        }
    }

    static String escape(String value) {
        StringBuilder sb = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            switch (c) {
                case '&':
                    sb.append("&amp;");
                    break;
                case '<':
                    sb.append("&lt;");
                    break;
                case '>':
                    sb.append("&gt;");
                    break;
                case '"':
                    sb.append("&quot;");
                    break;
                default:
                    // Characters XML 1.0 forbids are dropped
                    if (c >= 0x20 || c == '\t' || c == '\n' || c == '\r') {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    /**
     * The packet to write: ours when the image has none, the existing one with our description added,
     * or the existing one untouched when it already states a digital source type.
     */
    static String merge(String existing, Origin origin) throws MarkingException {
        if (existing == null) {
            return packet(origin);
        }
        if (existing.contains("DigitalSourceType")) {
            return existing;
        }
        int close = existing.lastIndexOf(RDF_CLOSE);
        if (close < 0) {
            throw new MarkingException("The image carries an XMP packet without rdf:RDF");
        }
        return existing.substring(0, close) + description(origin) + existing.substring(close);
    }

    // ---- PNG ----

    private static byte[] markPng(byte[] d, Origin origin) throws MarkingException {
        if (d.length < 8 + 12 || !startsWith(d, 0, PNG_SIGNATURE)) {
            throw new MarkingException("Not a PNG image");
        }
        String existing = null;
        int existingStart = -1;
        int existingEnd = -1;
        int firstIdat = -1;
        int pos = 8;
        while (pos + 12 <= d.length) {
            int length = readInt(d, pos);
            if (length < 0 || pos + 12L + length > d.length) {
                throw new MarkingException("Damaged PNG chunk");
            }
            String type = new String(d, pos + 4, 4, StandardCharsets.US_ASCII);
            if ("iTXt".equals(type) && existing == null) {
                existing = pngXmp(d, pos + 8, length);
                if (existing != null) {
                    existingStart = pos;
                    existingEnd = pos + 12 + length;
                }
            } else if ("IDAT".equals(type) && firstIdat < 0) {
                firstIdat = pos;
            }
            pos += 12 + length;
            if ("IEND".equals(type)) {
                break;
            }
        }
        if (firstIdat < 0) {
            throw new MarkingException("PNG without image data");
        }
        byte[] chunk = pngXmpChunk(merge(existing, origin));
        ByteArrayOutputStream out = new ByteArrayOutputStream(d.length + chunk.length);
        if (existing != null) {
            // Replace the packet where it was
            out.write(d, 0, existingStart);
            out.write(chunk, 0, chunk.length);
            out.write(d, existingEnd, d.length - existingEnd);
        } else {
            // Before the image data, where readers that stop early still find it
            out.write(d, 0, firstIdat);
            out.write(chunk, 0, chunk.length);
            out.write(d, firstIdat, d.length - firstIdat);
        }
        return out.toByteArray();
    }

    /** The XMP text of an uncompressed iTXt chunk with the XMP keyword, else {@code null}. */
    private static String pngXmp(byte[] d, int start, int length) {
        byte[] keyword = PNG_XMP_KEYWORD.getBytes(StandardCharsets.US_ASCII);
        if (length < keyword.length + 5 || !startsWith(d, start, keyword) || d[start + keyword.length] != 0
                || d[start + keyword.length + 1] != 0) {
            return null;
        }
        int end = start + length;
        int p = start + keyword.length + 3;
        // Language tag, then translated keyword, each null-terminated
        for (int i = 0; i < 2; i++) {
            while (p < end && d[p] != 0) {
                p++;
            }
            p++;
        }
        return p <= end ? new String(d, p, end - p, StandardCharsets.UTF_8) : null;
    }

    private static byte[] pngXmpChunk(String xmp) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        byte[] type = "iTXt".getBytes(StandardCharsets.US_ASCII);
        body.write(type, 0, 4);
        byte[] keyword = PNG_XMP_KEYWORD.getBytes(StandardCharsets.US_ASCII);
        body.write(keyword, 0, keyword.length);
        // Null separator, compression flag 0, method 0, empty language tag, empty translated keyword
        byte[] header = {0, 0, 0, 0, 0};
        body.write(header, 0, header.length);
        byte[] text = xmp.getBytes(StandardCharsets.UTF_8);
        body.write(text, 0, text.length);
        byte[] typeAndData = body.toByteArray();

        CRC32 crc = new CRC32();
        crc.update(typeAndData, 0, typeAndData.length);
        ByteArrayOutputStream chunk = new ByteArrayOutputStream(typeAndData.length + 8);
        writeInt(chunk, typeAndData.length - 4);
        chunk.write(typeAndData, 0, typeAndData.length);
        writeInt(chunk, (int) crc.getValue());
        return chunk.toByteArray();
    }

    // ---- JPEG ----

    private static byte[] markJpeg(byte[] d, Origin origin) throws MarkingException {
        if (d.length < 4 || (d[0] & 0xff) != 0xFF || (d[1] & 0xff) != 0xD8) {
            throw new MarkingException("Not a JPEG image");
        }
        byte[] signature = JPEG_XMP_SIGNATURE.getBytes(StandardCharsets.US_ASCII);
        String existing = null;
        int existingStart = -1;
        int existingEnd = -1;
        int insertAt = 2;
        int pos = 2;
        while (pos + 4 <= d.length && (d[pos] & 0xff) == 0xFF) {
            int marker = d[pos + 1] & 0xff;
            if (marker == 0xDA || marker == 0xD9) {
                break;
            }
            int length = ((d[pos + 2] & 0xff) << 8) | (d[pos + 3] & 0xff);
            if (length < 2 || pos + 2 + length > d.length) {
                throw new MarkingException("Damaged JPEG segment");
            }
            if (marker == 0xE1 && existing == null && length - 2 >= signature.length
                    && startsWith(d, pos + 4, signature)) {
                existing = new String(d, pos + 4 + signature.length, length - 2 - signature.length, StandardCharsets.UTF_8);
                existingStart = pos;
                existingEnd = pos + 2 + length;
            }
            // XMP goes after JFIF (APP0) and Exif (APP1), as both must come first
            if (marker == 0xE0 || (marker == 0xE1 && insertAt == pos)) {
                insertAt = pos + 2 + length;
            }
            pos += 2 + length;
        }
        byte[] xmp = merge(existing, origin).getBytes(StandardCharsets.UTF_8);
        if (xmp.length > JPEG_MAX_XMP) {
            throw new MarkingException("The XMP packet does not fit in one JPEG segment");
        }
        ByteArrayOutputStream segment = new ByteArrayOutputStream(xmp.length + 4 + signature.length);
        segment.write(0xFF);
        segment.write(0xE1);
        int length = 2 + signature.length + xmp.length;
        segment.write(length >>> 8);
        segment.write(length & 0xff);
        segment.write(signature, 0, signature.length);
        segment.write(xmp, 0, xmp.length);
        byte[] app1 = segment.toByteArray();

        ByteArrayOutputStream out = new ByteArrayOutputStream(d.length + app1.length);
        int cut = existing != null ? existingStart : insertAt;
        int resume = existing != null ? existingEnd : insertAt;
        out.write(d, 0, cut);
        out.write(app1, 0, app1.length);
        out.write(d, resume, d.length - resume);
        return out.toByteArray();
    }

    // ---- WebP ----

    private static byte[] markWebp(byte[] d, Origin origin) throws MarkingException {
        if (d.length < 20 || !"RIFF".equals(fourCc(d, 0)) || !"WEBP".equals(fourCc(d, 8))) {
            throw new MarkingException("Not a WebP image");
        }
        int riffEnd = (int) Math.min(d.length, 8L + (readIntLe(d, 4) & 0xffffffffL));
        String first = fourCc(d, 12);
        ByteArrayOutputStream body = new ByteArrayOutputStream(d.length + 1024);
        String existing = null;
        if ("VP8X".equals(first)) {
            int pos = 12;
            while (pos + 8 <= riffEnd) {
                String type = fourCc(d, pos);
                int size = readIntLe(d, pos + 4);
                int padded = size + (size & 1);
                if (size < 0 || pos + 8L + size > riffEnd) {
                    throw new MarkingException("Damaged WebP chunk");
                }
                if ("XMP ".equals(type)) {
                    existing = new String(d, pos + 8, size, StandardCharsets.UTF_8);
                } else {
                    byte[] chunk = Arrays.copyOfRange(d, pos, Math.min(riffEnd, pos + 8 + padded));
                    if ("VP8X".equals(type)) {
                        // Flags byte: set the XMP bit
                        chunk[8] |= 0x04;
                    }
                    body.write(chunk, 0, chunk.length);
                }
                pos += 8 + padded;
            }
        } else if ("VP8 ".equals(first) || "VP8L".equals(first)) {
            int[] size = DamService.webpDimensions(d);
            if (size == null || size[0] < 1 || size[1] < 1) {
                throw new MarkingException("Cannot read the size of the WebP image");
            }
            boolean alpha = "VP8L".equals(first) && d.length > 24 && ((d[24] & 0xff) >>> 4 & 1) == 1;
            byte[] vp8x = new byte[18];
            System.arraycopy("VP8X".getBytes(StandardCharsets.US_ASCII), 0, vp8x, 0, 4);
            vp8x[4] = 10;
            vp8x[8] = (byte) (0x04 | (alpha ? 0x10 : 0));
            writeU24Le(vp8x, 12, size[0] - 1);
            writeU24Le(vp8x, 15, size[1] - 1);
            body.write(vp8x, 0, vp8x.length);
            body.write(d, 12, riffEnd - 12);
        } else {
            throw new MarkingException("Unknown WebP format " + first);
        }
        byte[] xmp = merge(existing, origin).getBytes(StandardCharsets.UTF_8);
        byte[] header = new byte[8];
        System.arraycopy("XMP ".getBytes(StandardCharsets.US_ASCII), 0, header, 0, 4);
        writeIntLe(header, 4, xmp.length);
        body.write(header, 0, 8);
        body.write(xmp, 0, xmp.length);
        if ((xmp.length & 1) == 1) {
            body.write(0);
        }
        byte[] chunks = body.toByteArray();
        byte[] out = new byte[12 + chunks.length];
        System.arraycopy(d, 0, out, 0, 12);
        writeIntLe(out, 4, 4 + chunks.length);
        System.arraycopy(chunks, 0, out, 12, chunks.length);
        return out;
    }

    // ---- bytes ----

    private static boolean startsWith(byte[] d, int offset, byte[] prefix) {
        if (offset + prefix.length > d.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (d[offset + i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static String fourCc(byte[] d, int offset) {
        return offset + 4 <= d.length ? new String(d, offset, 4, StandardCharsets.US_ASCII) : "";
    }

    private static int readInt(byte[] d, int offset) {
        return (d[offset] & 0xff) << 24 | (d[offset + 1] & 0xff) << 16 | (d[offset + 2] & 0xff) << 8 | (d[offset + 3] & 0xff);
    }

    private static void writeInt(ByteArrayOutputStream out, int value) {
        out.write(value >>> 24);
        out.write(value >>> 16 & 0xff);
        out.write(value >>> 8 & 0xff);
        out.write(value & 0xff);
    }

    private static int readIntLe(byte[] d, int offset) {
        return (d[offset] & 0xff) | (d[offset + 1] & 0xff) << 8 | (d[offset + 2] & 0xff) << 16 | (d[offset + 3] & 0xff) << 24;
    }

    private static void writeIntLe(byte[] d, int offset, int value) {
        d[offset] = (byte) value;
        d[offset + 1] = (byte) (value >>> 8);
        d[offset + 2] = (byte) (value >>> 16);
        d[offset + 3] = (byte) (value >>> 24);
    }

    private static void writeU24Le(byte[] d, int offset, int value) {
        d[offset] = (byte) value;
        d[offset + 1] = (byte) (value >>> 8);
        d[offset + 2] = (byte) (value >>> 16);
    }
}
