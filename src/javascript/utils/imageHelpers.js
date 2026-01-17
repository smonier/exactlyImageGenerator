/**
 * Image processing and conversion utilities
 */

import {ASPECT_RATIOS} from './constants';

/**
 * Convert aspect ratio to pixel dimensions
 * @param {string} ratio - Aspect ratio string (e.g., "16:9")
 * @returns {number[]} Array of [width, height]
 */
export const aspectRatioToSize = (ratio) => {
    return ASPECT_RATIOS[ratio] || ASPECT_RATIOS['1:1'];
};

/**
 * Convert image URL to base64
 * @param {string} imageUrl - The image URL
 * @returns {Promise<string>} Base64 encoded image data
 */
export const imageUrlToBase64 = async (imageUrl) => {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result) {
                    // Remove data URL prefix (e.g., "data:image/png;base64,")
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('Failed to convert image to base64'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error converting image to base64:', error);
        throw error;
    }
};

/**
 * Validate image dimensions meet minimum requirements
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} minSize - Minimum required size for shortest dimension
 * @returns {boolean} True if image meets requirements
 */
export const validateImageSize = (width, height, minSize = 1024) => {
    return Math.min(width, height) >= minSize;
};

/**
 * Format image dimensions for display
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} Formatted dimensions string (e.g., "1024 × 768px")
 */
export const formatImageDimensions = (width, height) => {
    return `${width} × ${height}px`;
};

/**
 * Generate filename for saved image
 * @param {string} prefix - Filename prefix
 * @param {number} index - Image index
 * @returns {string} Generated filename
 */
export const generateImageFilename = (prefix = 'generated', index = 0) => {
    const timestamp = Date.now();
    return `${prefix}-${timestamp}-${index}.png`;
};
