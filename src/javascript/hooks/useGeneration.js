/**
 * Custom hooks for image generation operations
 */

import {useState, useCallback} from 'react';
import {useMutation} from '@apollo/client';
import {
    GENERATE_EXACTLY_IMAGES,
    SAVE_GENERATED_IMAGES_TO_DAM
} from '../graphql/operations';
import {
    extractGeneratedImages,
    extractErrorMessage
} from '../utils/responseParser';
import {aspectRatioToSize, generateImageFilename} from '../utils/imageHelpers';

/**
 * Hook for generating images
 * @param {string} styleUuid - Style UUID
 * @param {Function} onSuccess - Success callback with (jobId, urls)
 * @param {Function} onError - Error callback with error message
 * @returns {Object} Generation state and function
 */
export const useGenerateImages = (styleUuid, onSuccess, onError) => {
    const [projectUuid, setProjectUuid] = useState(null);
    
    const [generateImages, {loading}] = useMutation(GENERATE_EXACTLY_IMAGES, {
        onCompleted: data => {
            const result = extractGeneratedImages(data);
            if (result) {
                setProjectUuid(result.jobId);
                if (onSuccess) onSuccess(result.jobId, result.urls);
            } else {
                const errorMsg = extractErrorMessage(data);
                if (onError) onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Generation error:', error);
            if (onError) onError(error.message);
        }
    });
    
    const generate = useCallback((prompt, numVariations, aspectRatio, referenceImages = []) => {
        const size = aspectRatioToSize(aspectRatio);
        const params = {
            num_images: numVariations,
            size: size
        };
        
        // Add reference images if provided
        if (referenceImages.length > 0) {
            params.reference_images = referenceImages.map(ref => ({
                base64: ref.base64,
                purpose: ref.purpose,
                ...(ref.purpose === 'sketch' && ref.strength !== undefined 
                    ? {strength: ref.strength} 
                    : {})
            }));
        }
        
        return generateImages({
            variables: {
                styleUuid,
                prompt,
                params: JSON.stringify(params)
            }
        });
    }, [styleUuid, generateImages]);
    
    return {
        generate,
        loading,
        projectUuid
    };
};

/**
 * Hook for saving generated images to DAM
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Object} Save state and function
 */
export const useSaveToDAM = (onSuccess, onError) => {
    const [savedAssets, setSavedAssets] = useState([]);
    
    const [saveToDam, {loading}] = useMutation(SAVE_GENERATED_IMAGES_TO_DAM, {
        onCompleted: data => {
            if (data?.exactly?.saveGeneratedImagesToDam?.successful) {
                console.log('Images saved successfully');
                if (onSuccess) onSuccess(data);
            } else {
                const errorMsg = extractErrorMessage(data);
                if (onError) onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Save error:', error);
            if (onError) onError(error.message);
        }
    });
    
    const save = useCallback((projectUuid, selectedIndices, generatedUrls, folderPath, prompt) => {
        const selection = selectedIndices.map(idx => ({
            remoteUrl: generatedUrls[idx],
            fileName: generateImageFilename('generated', idx),
            title: `Generated: ${prompt.substring(0, 50)}`
        }));
        
        return saveToDam({
            variables: {
                projectUuid,
                folderPath,
                selectionJson: JSON.stringify(selection)
            }
        });
    }, [saveToDam]);
    
    return {
        save,
        loading,
        savedAssets,
        setSavedAssets
    };
};

/**
 * Hook for managing image selection
 * @param {number} initialCount - Initial number of images
 * @returns {Object} Selection state and functions
 */
export const useImageSelection = (initialCount = 0) => {
    const [selectedImages, setSelectedImages] = useState([]);
    
    const toggleImage = useCallback((index) => {
        setSelectedImages(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            }
            return [...prev, index];
        });
    }, []);
    
    const selectAll = useCallback((count) => {
        setSelectedImages(Array.from({length: count}, (_, i) => i));
    }, []);
    
    const clearSelection = useCallback(() => {
        setSelectedImages([]);
    }, []);
    
    const isSelected = useCallback((index) => {
        return selectedImages.includes(index);
    }, [selectedImages]);
    
    return {
        selectedImages,
        setSelectedImages,
        toggleImage,
        selectAll,
        clearSelection,
        isSelected
    };
};
