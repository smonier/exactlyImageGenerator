package org.jahia.se.modules.exactlyImageGenerator.services;

import org.osgi.service.component.annotations.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Remembers, for a few hours, the image URLs that the Exactly API returned for a generation, keyed by
 * a generation id handed to the browser. Saving to the DAM then names a generation and image indices,
 * never a URL, so the server only ever downloads URLs it received from Exactly itself.
 * <p>
 * In memory and per cluster node: a generation older than {@link #TTL_MS} or made on another node must
 * be generated again. Thread-safe.
 */
@Component(service = GeneratedImageRegistry.class)
public class GeneratedImageRegistry {

    static final long TTL_MS = 6L * 60 * 60 * 1000;
    static final int MAX_ENTRIES = 1000;

    /** One generation: who made it, on which site and style, and the URLs Exactly returned. */
    public static final class Generation {
        private final String username;
        private final String siteKey;
        private final String styleUuid;
        private final String prompt;
        private final List<String> urls;
        private final long createdAt;

        Generation(String username, String siteKey, String styleUuid, String prompt, List<String> urls) {
            this.username = username;
            this.siteKey = siteKey;
            this.styleUuid = styleUuid;
            this.prompt = prompt;
            this.urls = Collections.unmodifiableList(new ArrayList<>(urls));
            this.createdAt = System.currentTimeMillis();
        }

        public String getUsername() {
            return username;
        }

        public String getSiteKey() {
            return siteKey;
        }

        public String getStyleUuid() {
            return styleUuid;
        }

        public String getPrompt() {
            return prompt;
        }

        public List<String> getUrls() {
            return urls;
        }
    }

    private final Map<String, Generation> generations = new ConcurrentHashMap<>();

    /**
     * Records a generation.
     *
     * @return the generation id to hand to the browser
     */
    public String register(String username, String siteKey, String styleUuid, String prompt, List<String> urls) {
        evict();
        String id = UUID.randomUUID().toString();
        generations.put(id, new Generation(username, siteKey, styleUuid, prompt, urls));
        return id;
    }

    /**
     * @param generationId id returned by {@link #register}
     * @param username     the caller
     * @return the generation, or {@code null} when unknown, expired, or made by another user
     */
    public Generation get(String generationId, String username) {
        Generation generation = generationId != null ? generations.get(generationId) : null;
        if (generation == null || System.currentTimeMillis() - generation.createdAt > TTL_MS
                || !generation.username.equals(username)) {
            return null;
        }
        return generation;
    }

    private void evict() {
        long now = System.currentTimeMillis();
        generations.values().removeIf(g -> now - g.createdAt > TTL_MS);
        Iterator<String> oldest = generations.keySet().iterator();
        while (generations.size() >= MAX_ENTRIES && oldest.hasNext()) {
            oldest.next();
            oldest.remove();
        }
    }
}
