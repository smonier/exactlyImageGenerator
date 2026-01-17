/**
 * Jahia Content Editor picker utilities
 */

import {getSiteKey, getUILanguage} from './jahiaHelpers';

/**
 * Open media picker for selecting images
 * @param {Function} onSelect - Callback when images are selected
 * @param {boolean} isMultiple - Allow multiple selection
 * @returns {void}
 */
export const openImagePicker = (onSelect, isMultiple = true) => {
    if (!window.CE_API?.openPicker) {
        throw new Error('Content Editor API is not available');
    }
    
    window.CE_API.openPicker({
        type: 'image',
        site: getSiteKey(),
        lang: getUILanguage(),
        isMultiple,
        setValue: onSelect
    });
};

/**
 * Open folder picker for selecting a destination folder
 * @param {Function} onSelect - Callback when folder is selected
 * @returns {void}
 */
export const openFolderPicker = (onSelect) => {
    if (!window.CE_API?.openPicker) {
        throw new Error('Content Editor API is not available');
    }
    
    window.CE_API.openPicker({
        type: 'folder',
        site: getSiteKey(),
        lang: getUILanguage(),
        isMultiple: false,
        setValue: onSelect
    });
};

/**
 * Filter selected assets to only include new ones
 * @param {Array} selectedItems - Newly selected items
 * @param {Array} existingUuids - Array of existing UUIDs
 * @returns {Array} Filtered array of new assets
 */
export const filterNewAssets = (selectedItems, existingUuids = []) => {
    if (!selectedItems || selectedItems.length === 0) {
        return [];
    }
    
    return selectedItems.filter(
        item => item.uuid && !existingUuids.includes(item.uuid)
    );
};

/**
 * Extract asset information from picker result
 * @param {Object} asset - Asset object from picker
 * @returns {Object} Normalized asset information
 */
export const normalizeAsset = (asset) => {
    return {
        uuid: asset.uuid,
        name: asset.name || asset.displayName,
        path: asset.path,
        url: asset.url || asset.downloadUrl,
        type: asset.type
    };
};
