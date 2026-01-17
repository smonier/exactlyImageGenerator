/**
 * Progress tracking utilities
 */

import {DEFAULTS} from './constants';

/**
 * Create progress tracker for multiple items
 * @param {Array} items - Array of items to track
 * @param {number} initialProgress - Initial progress value
 * @returns {Object} Progress tracker object
 */
export const createProgressTracker = (items, initialProgress = 0) => {
    const tracker = {};
    items.forEach(item => {
        const key = item.uuid || item;
        tracker[key] = initialProgress;
    });
    return tracker;
};

/**
 * Simulate upload progress (for when API doesn't provide real-time updates)
 * @param {Array} items - Items being uploaded
 * @param {Function} onUpdate - Callback for progress updates
 * @param {Function} onComplete - Callback when complete
 * @returns {Object} Control object with stop() method
 */
export const simulateProgress = (items, onUpdate, onComplete) => {
    // Initialize progress at 10%
    const initialProgress = createProgressTracker(items, 10);
    onUpdate(initialProgress);
    
    // Increment progress every 500ms until 90%
    const interval = setInterval(() => {
        onUpdate(prev => {
            const updated = {};
            let allComplete = true;
            
            Object.keys(prev).forEach(key => {
                const newValue = Math.min(
                    prev[key] + DEFAULTS.PROGRESS_INCREMENT, 
                    90
                );
                updated[key] = newValue;
                if (newValue < 90) allComplete = false;
            });
            
            if (allComplete) {
                clearInterval(interval);
            }
            
            return updated;
        });
    }, DEFAULTS.PROGRESS_UPDATE_INTERVAL);
    
    return {
        stop: () => clearInterval(interval),
        complete: () => {
            clearInterval(interval);
            const completeProgress = {};
            items.forEach(item => {
                const key = item.uuid || item;
                completeProgress[key] = 100;
            });
            onUpdate(completeProgress);
            if (onComplete) onComplete();
        }
    };
};

/**
 * Check if training is complete based on progress
 * @param {number} progress - Progress percentage
 * @returns {boolean} True if complete
 */
export const isTrainingComplete = (progress) => {
    return progress >= 100;
};

/**
 * Check if status indicates training is in progress
 * @param {string} status - Status string
 * @returns {boolean} True if training
 */
export const isTraining = (status) => {
    return status === 'training';
};

/**
 * Check if status indicates model is ready
 * @param {string} status - Status string
 * @returns {boolean} True if ready
 */
export const isReady = (status) => {
    return status === 'ready';
};
