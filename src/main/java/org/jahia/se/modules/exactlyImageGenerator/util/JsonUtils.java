package org.jahia.se.modules.exactlyImageGenerator.util;

import org.json.JSONArray;
import org.json.JSONObject;

import javax.jcr.Node;
import javax.jcr.PropertyIterator;
import javax.jcr.RepositoryException;
import javax.jcr.Value;
import java.util.*;

/**
 * Utility class for JSON operations and JCR node conversions
 */
public class JsonUtils {
    
    /**
     * Convert JCR node properties to JSON object
     */
    public static JSONObject nodeToJson(Node node) throws RepositoryException {
        JSONObject json = new JSONObject();
        
        PropertyIterator properties = node.getProperties();
        while (properties.hasNext()) {
            javax.jcr.Property property = properties.nextProperty();
            String name = property.getName();
            
            // Skip system properties
            if (name.startsWith("jcr:") || name.startsWith("j:")) {
                continue;
            }
            
            if (property.isMultiple()) {
                JSONArray array = new JSONArray();
                for (Value value : property.getValues()) {
                    array.put(value.getString());
                }
                json.put(name, array);
            } else {
                json.put(name, property.getString());
            }
        }
        
        return json;
    }
    
    /**
     * Safe JSON string extraction
     */
    public static String safeGetString(JSONObject json, String key, String defaultValue) {
        if (json == null || !json.has(key)) {
            return defaultValue;
        }
        return json.optString(key, defaultValue);
    }
    
    /**
     * Safe JSON integer extraction
     */
    public static int safeGetInt(JSONObject json, String key, int defaultValue) {
        if (json == null || !json.has(key)) {
            return defaultValue;
        }
        return json.optInt(key, defaultValue);
    }
    
    /**
     * Safe JSON array extraction
     */
    public static JSONArray safeGetArray(JSONObject json, String key) {
        if (json == null || !json.has(key)) {
            return new JSONArray();
        }
        return json.optJSONArray(key);
    }
    
    /**
     * Convert JSON array to string list
     */
    public static List<String> jsonArrayToList(JSONArray array) {
        List<String> list = new ArrayList<>();
        if (array != null) {
            for (int i = 0; i < array.length(); i++) {
                list.add(array.optString(i));
            }
        }
        return list;
    }
    
    /**
     * Convert string list to JSON array
     */
    public static JSONArray listToJsonArray(List<String> list) {
        JSONArray array = new JSONArray();
        if (list != null) {
            for (String item : list) {
                array.put(item);
            }
        }
        return array;
    }
    
    /**
     * Merge two JSON objects (second overwrites first)
     */
    public static JSONObject merge(JSONObject base, JSONObject override) {
        if (base == null) {
            return override != null ? override : new JSONObject();
        }
        if (override == null) {
            return base;
        }
        
        JSONObject result = new JSONObject(base.toString());
        for (String key : override.keySet()) {
            result.put(key, override.get(key));
        }
        return result;
    }
    
    /**
     * Validate JSON string
     */
    public static boolean isValidJson(String jsonString) {
        if (jsonString == null || jsonString.trim().isEmpty()) {
            return false;
        }
        try {
            new JSONObject(jsonString);
            return true;
        } catch (Exception e) {
            try {
                new JSONArray(jsonString);
                return true;
            } catch (Exception e2) {
                return false;
            }
        }
    }
    
    /**
     * Pretty print JSON
     */
    public static String prettyPrint(JSONObject json) {
        if (json == null) {
            return "{}";
        }
        try {
            return json.toString(2);
        } catch (Exception e) {
            return json.toString();
        }
    }
}
