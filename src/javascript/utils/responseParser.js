/**
 * Utilities for parsing API responses
 */

/**
 * Safely parse JSON from API response message
 * @param {string} message - JSON string to parse
 * @param {*} defaultValue - Default value if parse fails
 * @returns {*} Parsed JSON or default value
 */
export const parseJSONResponse = (message, defaultValue = null) => {
    if (!message) return defaultValue;
    
    try {
        return JSON.parse(message);
    } catch (error) {
        console.error('Failed to parse JSON response:', error);
        return defaultValue;
    }
};

/**
 * Extract model status from API response
 * @param {Object} response - API response object
 * @returns {Object} Normalized status object
 */
export const extractModelStatus = (response) => {
    if (!response?.exactly?.getModel?.successful) {
        return null;
    }
    
    const model = parseJSONResponse(response.exactly.getModel.message, {});
    return {
        status: model.status || 'unknown',
        name: model.name,
        description: model.description,
        uid: model.uid
    };
};

/**
 * Extract training progress from API response
 * @param {Object} response - API response object
 * @returns {Object} Normalized progress object
 */
export const extractTrainingProgress = (response) => {
    if (!response?.exactly?.getTrainingProgress?.successful) {
        return null;
    }
    
    const progress = parseJSONResponse(response.exactly.getTrainingProgress.message, {});
    return {
        status: progress.status || 'training',
        progress: progress.progress !== undefined ? progress.progress : 0,
        message: progress.progress === 100 ? 'Training complete' : 'Training in progress'
    };
};

/**
 * Extract training images from API response
 * @param {Object} response - API response object
 * @returns {Array} Array of image objects
 */
export const extractTrainingImages = (response) => {
    if (!response?.exactly?.getTrainingImages?.successful) {
        return [];
    }
    
    return parseJSONResponse(response.exactly.getTrainingImages.message, []);
};

/**
 * Extract generated images from API response
 * @param {Object} response - API response object
 * @returns {Object} Object with urls and jobId
 */
export const extractGeneratedImages = (response) => {
    if (!response?.exactly?.generateImages?.successful) {
        return null;
    }
    
    const result = parseJSONResponse(response.exactly.generateImages.message, {});
    return {
        urls: result.urls || [],
        jobId: result.jobId
    };
};

/**
 * Extract error message from API response or error object
 * @param {Object} errorOrResponse - Error object or API response
 * @returns {string} Error message
 */
export const extractErrorMessage = (errorOrResponse) => {
    // Direct error object
    if (errorOrResponse?.message) {
        return errorOrResponse.message;
    }
    
    // GraphQL response with error
    if (errorOrResponse?.exactly) {
        const operations = ['generateImages', 'trainStyle', 'uploadTrainingImages', 'deleteTrainingImage'];
        for (const op of operations) {
            if (errorOrResponse.exactly[op]?.message) {
                return errorOrResponse.exactly[op].message;
            }
        }
    }
    
    return 'An unknown error occurred';
};
