/**
 * Application constants and configuration
 */

// Wizard step definitions
export const STEPS = {
    STYLE: 0,
    TRAIN: 1,
    GENERATE: 2
};

// Aspect ratio configurations
export const ASPECT_RATIOS = {
    '9:16': [576, 1024],
    '2:3': [683, 1024],
    '3:4': [768, 1024],
    '1:1': [1024, 1024],
    '4:3': [1024, 768],
    '3:2': [1024, 683],
    '16:9': [1024, 576]
};

// Default values
export const DEFAULTS = {
    NUM_VARIATIONS: 4,
    ASPECT_RATIO: '1:1',
    POLLING_INTERVAL: 5000, // 5 seconds
    PROGRESS_INCREMENT: 10,
    PROGRESS_UPDATE_INTERVAL: 500 // 0.5 seconds
};

// Status values
export const STATUS = {
    DRAFT: 'draft',
    TRAINING: 'training',
    READY: 'ready',
    FAILED: 'failed',
    UNKNOWN: 'unknown'
};

// Image size requirements
export const IMAGE_REQUIREMENTS = {
    MIN_SIZE: 1024,
    MIN_TRAINING_IMAGES: 1
};
