/**
 * API calls for Exactly.ai operations via Jahia actions
 */

/**
 * Sync styles from Exactly API
 */
export const syncExactlyStyles = async (siteKey) => {
    const response = await fetch('/cms/render/default/en/sites/' + siteKey + '.syncExactlyStyles.do', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
};

/**
 * Train a style with DAM assets
 */
export const trainExactlyStyle = async (siteKey, styleUuid, damAssetUuids) => {
    const response = await fetch(`${API_BASE}/trainStyle`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteKey, styleUuid, damAssetUuids }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to train style');
    }
    
    return response.json();
};

/**
 * Generate images from prompt
 */
export const generateExactlyImages = async (siteKey, styleUuid, prompt, projectName, numImages = 4) => {
    const response = await fetch(`${API_BASE}/generateImages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            siteKey, 
            styleUuid, 
            prompt, 
            projectName,
            numImages 
        }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate images');
    }
    
    return response.json();
};

/**
 * Save generated images to DAM
 */
export const saveGeneratedImagesToDam = async (siteKey, imageUrls, targetPath) => {
    const response = await fetch(`${API_BASE}/saveToDAM`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            siteKey, 
            imageUrls, 
            targetPath 
        }),
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save images to DAM');
    }
    
    return response.json();
};
