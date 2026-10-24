export const NS = 'exactlyImageGenerator';

export const TABS = ['styles', 'training', 'generate'];

export const STATUS = {
    DRAFT: 'draft',
    TRAINING: 'training',
    READY: 'ready',
    FAILED: 'failed',
    UNKNOWN: 'unknown'
};

// Exactly image sizes per aspect ratio, [width, height]
export const ASPECT_RATIOS = {
    '9:16': [576, 1024],
    '2:3': [683, 1024],
    '3:4': [768, 1024],
    '1:1': [1024, 1024],
    '4:3': [1024, 768],
    '3:2': [1024, 683],
    '16:9': [1024, 576]
};

export const REFERENCE_PURPOSES = ['reference', 'style', 'sketch', 'instruct', 'product', 'character'];

export const POLL_INTERVAL_MS = 5000;
export const MAX_VARIATIONS = 4;
export const MIN_TRAINING_IMAGES = 10;
export const MAX_REFERENCE_IMAGE_BYTES = 2.5 * 1024 * 1024;
