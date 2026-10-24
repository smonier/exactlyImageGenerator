import {MAX_REFERENCE_IMAGE_BYTES} from './constants';

/** Only https URLs from Exactly are rendered (images and links); anything else is dropped. */
export const isHttpsUrl = url => {
    try {
        return new URL(url).protocol === 'https:';
    } catch {
        return false;
    }
};

const contextPath = () => window.contextJsParameters?.contextPath || '';

const encodePath = path => path.split('/').map(encodeURIComponent).join('/');

/** URL of a file of the edit workspace, optionally as one of Jahia's thumbnails. */
export const fileUrl = (path, {thumbnail = false} = {}) =>
    `${contextPath()}/files/default${encodePath(path)}${thumbnail ? '?t=thumbnail2' : ''}`;

/** Whether jContent's picker API is there (it is in jContent; not in other back-office apps). */
export const canOpenPicker = () => typeof window.CE_API?.openPicker === 'function';

const normalize = item => ({
    uuid: item.uuid,
    path: item.path,
    name: item.displayName || item.name || item.path?.split('/').pop()
});

/**
 * Opens jContent's picker on the current site.
 *
 * @param {object} options {type: 'image' | 'folder', site, lang, uilang, isMultiple, onSelect(items)}
 */
export const openPicker = ({type, site, lang, uilang, isMultiple = false, onSelect}) => {
    window.CE_API.openPicker({
        type,
        site,
        lang,
        uilang,
        isMultiple,
        setValue: items => {
            const list = (Array.isArray(items) ? items : [items]).filter(Boolean).map(normalize).filter(i => i.uuid || i.path);
            if (list.length > 0) {
                onSelect(list);
            }
        }
    });
};

/**
 * Reads a media library image as base64 for an Exactly reference image.
 *
 * @returns {Promise<{base64: string, previewUrl: string}>}
 */
export const readImageAsBase64 = async path => {
    const response = await fetch(fileUrl(path), {credentials: 'same-origin'});
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
        throw new Error('not-an-image');
    }
    if (blob.size > MAX_REFERENCE_IMAGE_BYTES) {
        throw new Error('too-large');
    }
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
    return {previewUrl: dataUrl, base64: dataUrl.split(',')[1]};
};
