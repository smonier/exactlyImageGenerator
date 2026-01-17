/**
 * Jahia-specific helper functions
 */

/**
 * Get the current site key from Jahia context
 * @returns {string} The site key
 */
export const getSiteKey = () => {
    return window.contextJsParameters?.siteKey || 
           window.jahiaGWTParameters?.siteKey || 
           'systemsite';
};

/**
 * Get the current UI language from Jahia context
 * @returns {string} The language code
 */
export const getUILanguage = () => {
    return window.jahiaGWTParameters?.uilang || 'en';
};

/**
 * Check if Content Editor API is available
 * @returns {boolean} True if CE_API is available
 */
export const isCEAPIAvailable = () => {
    return typeof window.CE_API !== 'undefined' && 
           typeof window.CE_API.openPicker === 'function';
};

/**
 * Construct default workspace URL for an asset
 * @param {string} path - The asset path
 * @returns {string} The default workspace URL
 */
export const getDefaultWorkspaceURL = (path) => {
    if (!path) return '';
    
    // If path starts with /files/, return as is
    if (path.startsWith('/files/default')) {
        return path;
    }
    
    // If path starts with /sites/, convert to default workspace
    if (path.startsWith('/sites/')) {
        return `/files/default${path}`;
    }
    
    // Otherwise prepend /files/default
    return `/files/default${path}`;
};

/**
 * Generate default target folder path for site
 * @param {string} siteKey - The site key
 * @returns {string} The folder path
 */
export const getDefaultTargetFolder = (siteKey) => {
    return `/sites/${siteKey}/files/exactly-generated`;
};
