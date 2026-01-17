/**
 * Custom hooks for training operations
 */

import {useState, useEffect, useRef, useCallback} from 'react';
import {useMutation} from '@apollo/client';
import {
    TRAIN_EXACTLY_STYLE,
    UPLOAD_TRAINING_IMAGES,
    GET_TRAINING_IMAGES,
    DELETE_TRAINING_IMAGE,
    GET_MODEL,
    GET_TRAINING_PROGRESS
} from '../graphql/operations';
import {
    extractModelStatus,
    extractTrainingProgress,
    extractTrainingImages
} from '../utils/responseParser';
import {isTraining, isTrainingComplete} from '../utils/progressHelpers';
import {DEFAULTS} from '../utils/constants';

/**
 * Hook for managing training progress polling
 * @param {string} styleUuid - Style UUID
 * @returns {Object} Progress state and controls
 */
export const useTrainingProgress = (styleUuid) => {
    const [trainingStatus, setTrainingStatus] = useState(null);
    const intervalRef = useRef(null);
    
    const [getProgress] = useMutation(GET_TRAINING_PROGRESS, {
        onCompleted: data => {
            const progress = extractTrainingProgress(data);
            if (progress) {
                setTrainingStatus(prev => ({
                    ...(prev || {}),
                    ...progress
                }));
                
                // Stop polling when complete
                if (isTrainingComplete(progress.progress) || 
                    progress.status === 'completed' || 
                    progress.status === 'failed') {
                    stopPolling();
                }
            }
        }
    });
    
    const startPolling = useCallback(() => {
        if (intervalRef.current) return; // Already polling
        
        intervalRef.current = setInterval(() => {
            getProgress({variables: {styleUuid}});
        }, DEFAULTS.POLLING_INTERVAL);
    }, [styleUuid, getProgress]);
    
    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);
    
    const fetchProgress = useCallback(() => {
        return getProgress({variables: {styleUuid}});
    }, [styleUuid, getProgress]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => stopPolling();
    }, [stopPolling]);
    
    // Auto-start/stop polling based on status
    useEffect(() => {
        if (isTraining(trainingStatus?.status)) {
            startPolling();
        } else {
            stopPolling();
        }
    }, [trainingStatus?.status, startPolling, stopPolling]);
    
    return {
        trainingStatus,
        setTrainingStatus,
        startPolling,
        stopPolling,
        fetchProgress
    };
};

/**
 * Hook for fetching and managing training images
 * @param {string} styleUuid - Style UUID
 * @returns {Object} Images state and fetch function
 */
export const useTrainingImages = (styleUuid) => {
    const [images, setImages] = useState([]);
    
    const [fetchImages, {loading}] = useMutation(GET_TRAINING_IMAGES, {
        onCompleted: data => {
            const imageList = extractTrainingImages(data);
            setImages(imageList);
        },
        onError: error => {
            console.error('Error fetching training images:', error);
            setImages([]);
        }
    });
    
    const refetch = useCallback(() => {
        return fetchImages({variables: {styleUuid}});
    }, [styleUuid, fetchImages]);
    
    return {
        images,
        loading,
        refetch
    };
};

/**
 * Hook for training model initialization
 * @param {string} styleUuid - Style UUID
 * @param {string} styleStatus - Style status
 * @returns {void}
 */
export const useTrainingInit = (styleUuid, styleStatus) => {
    const [initialized, setInitialized] = useState(false);
    const [getModel] = useMutation(GET_MODEL);
    
    useEffect(() => {
        if (!styleUuid || initialized) return;
        
        setInitialized(true);
        
        // Note: This hook doesn't return anything
        // It's meant to be used alongside useTrainingProgress and useTrainingImages
        // The component needs to manage those states separately
        
        // Initialization logic is handled by the component
    }, [styleUuid, styleStatus, initialized, getModel]);
};

/**
 * Hook for starting training
 * @param {string} styleUuid - Style UUID
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Object} Training mutation and state
 */
export const useStartTraining = (styleUuid, onSuccess, onError) => {
    const [trainStyle, {loading}] = useMutation(TRAIN_EXACTLY_STYLE, {
        onCompleted: data => {
            if (data?.exactly?.trainStyle?.successful) {
                if (onSuccess) onSuccess(data);
            } else {
                const errorMsg = data?.exactly?.trainStyle?.message || 'Training failed';
                if (onError) onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Training error:', error);
            if (onError) onError(error.message);
        }
    });
    
    const startTraining = useCallback(() => {
        return trainStyle({variables: {styleUuid}});
    }, [styleUuid, trainStyle]);
    
    return {
        startTraining,
        loading
    };
};

/**
 * Hook for uploading training images
 * @param {string} styleUuid - Style UUID
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Object} Upload mutation and state
 */
export const useUploadTrainingImages = (styleUuid, onSuccess, onError) => {
    const [uploadImages, {loading}] = useMutation(UPLOAD_TRAINING_IMAGES, {
        onCompleted: data => {
            if (data?.exactly?.uploadTrainingImages?.successful) {
                if (onSuccess) onSuccess(data);
            }
        },
        onError: error => {
            console.error('Upload error:', error);
            if (onError) onError(error);
        }
    });
    
    const upload = useCallback((damAssetUuids) => {
        return uploadImages({
            variables: {
                styleUuid,
                damAssetUuids
            }
        });
    }, [styleUuid, uploadImages]);
    
    return {
        upload,
        loading
    };
};

/**
 * Hook for deleting training images
 * @param {string} styleUuid - Style UUID
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @returns {Object} Delete mutation and state
 */
export const useDeleteTrainingImage = (styleUuid, onSuccess, onError) => {
    const [deleteImage, {loading}] = useMutation(DELETE_TRAINING_IMAGE, {
        onCompleted: data => {
            if (data?.exactly?.deleteTrainingImage?.successful) {
                if (onSuccess) onSuccess(data);
            }
        },
        onError: error => {
            console.error('Delete error:', error);
            if (onError) onError(error);
        }
    });
    
    const deleteTrainingImage = useCallback((imageUid) => {
        return deleteImage({
            variables: {
                styleUuid,
                imageUid
            }
        });
    }, [styleUuid, deleteImage]);
    
    return {
        deleteTrainingImage,
        loading
    };
};
