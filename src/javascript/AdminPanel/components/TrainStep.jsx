/**
 * Step 2: Training
 *
 * - Select DAM assets for training
 * - Start training job
 * - Display training status
 */

import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useMutation} from '@apollo/client';
import {Button, Typography, Input, Loader} from '@jahia/moonstone';
import {CloudUpload} from '@jahia/moonstone/dist/icons';
import {Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from '@material-ui/core';
import {TRAIN_EXACTLY_STYLE, UPLOAD_TRAINING_IMAGES, GET_TRAINING_IMAGES, DELETE_TRAINING_IMAGE, GET_MODEL, GET_TRAINING_PROGRESS, PUT_MODEL_TO_DRAFT, CANCEL_TRAINING} from '../../graphql/operations';
import StatusBadge from './StatusBadge';
import CircularProgress from './CircularProgress';
import './TrainStep.css';

// Get current site key from Jahia context
const getSiteKey = () => {
    return window.contextJsParameters?.siteKey || 'systemsite';
};

const TrainStep = ({styleUuid, styleName, styleStatus, styleDescription, onTrainingStart, onError}) => {
    const {t} = useTranslation('exactlyImageGenerator');
    const [damAssetInput, setDamAssetInput] = useState('');
    const [damAssets, setDamAssets] = useState([]);
    const [selectedAssets, setSelectedAssets] = useState([]); // Store full asset objects with paths
    const [uploadProgress, setUploadProgress] = useState({}); // Track upload progress per image
    const [trainingStatus, setTrainingStatus] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [existingImages, setExistingImages] = useState([]); // Images already uploaded to Exactly.ai
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [imageToDelete, setImageToDelete] = useState(null);
    
    const siteKey = getSiteKey();
    
    // Fetch existing training images
    const [fetchImages, {loading: loadingImages}] = useMutation(GET_TRAINING_IMAGES, {
        onCompleted: data => {
            if (data?.exactly?.getTrainingImages) {
                const response = data.exactly.getTrainingImages;
                if (response.successful && response.message) {
                    try {
                        const parsedImages = JSON.parse(response.message);
                        setExistingImages(parsedImages);
                    } catch (e) {
                        console.error('Failed to parse images JSON:', e);
                        setExistingImages([]);
                    }
                }
            }
        },
        onError: error => {
            console.error('Error fetching training images:', error);
        }
    });
    
    // Get model details mutation
    const [getModel] = useMutation(GET_MODEL);
    
    // Get training progress mutation
    const [getProgress] = useMutation(GET_TRAINING_PROGRESS, {
        onCompleted: data => {
            if (data?.exactly?.getTrainingProgress?.successful) {
                try {
                    const progress = JSON.parse(data.exactly.getTrainingProgress.message);
                    setTrainingStatus(prev => ({
                        ...(prev || {}),
                        status: progress.status || (prev?.status) || 'training',
                        progress: progress.progress !== undefined ? progress.progress : (prev?.progress || 0),
                        message: progress.progress === 100 ? 'Training complete' : 'Training in progress'
                    }));
                    
                    // If status changed to training, reload images
                    if (progress.status === 'training') {
                        fetchImages({
                            variables: {
                                styleUuid: styleUuid
                            }
                        });
                    }
                    
                    // Stop polling when progress reaches 100% or if failed
                    if (progress.progress >= 100 || progress.status === 'completed' || progress.status === 'failed') {
                        stopProgressPolling();
                        // Reload images when training completes
                        fetchImages({
                            variables: {
                                styleUuid: styleUuid
                            }
                        });
                    }
                } catch (e) {
                    console.error('Failed to parse progress:', e);
                }
            }
        }
    });

    const progressIntervalRef = React.useRef(null);

    const startProgressPolling = () => {
        // Poll every 5 seconds
        progressIntervalRef.current = setInterval(() => {
            getProgress({
                variables: {
                    styleUuid: styleUuid
                }
            });
        }, 5000);
    };

    const stopProgressPolling = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => stopProgressPolling();
    }, []);
    
    // Fetch model details, then progress if training, then images
    useEffect(() => {
        if (styleUuid) {
            // Step 1: Fetch model details from /public/v1/models/{uid}/
            getModel({
                variables: {
                    styleUuid: styleUuid
                }
            }).then(modelResult => {
                if (modelResult?.data?.exactly?.getModel?.successful) {
                    try {
                        const model = JSON.parse(modelResult.data.exactly.getModel.message);
                        const modelStatus = model.status;
                        
                        // Step 2: If training, get progress from /public/v1/models/{uid}/train/progress/
                        if (modelStatus === 'training') {
                            return getProgress({
                                variables: {
                                    styleUuid: styleUuid
                                }
                            }).then(progressResult => {
                                if (progressResult?.data?.exactly?.getTrainingProgress?.successful) {
                                    try {
                                        const progress = JSON.parse(progressResult.data.exactly.getTrainingProgress.message);
                                        setTrainingStatus({
                                            status: progress.status || modelStatus,
                                            progress: progress.progress || 0,
                                            message: 'Training in progress'
                                        });
                                        // Start polling if training and not complete
                                        if (progress.progress < 100) {
                                            startProgressPolling();
                                        }
                                    } catch (e) {
                                        console.error('Failed to parse progress:', e);
                                        setTrainingStatus({
                                            status: modelStatus,
                                            progress: 0,
                                            message: 'Training in progress'
                                        });
                                    }
                                }
                                return Promise.resolve();
                            });
                        } else {
                            // Not training, just set status from model
                            setTrainingStatus({
                                status: modelStatus,
                                progress: modelStatus === 'ready' ? 100 : 0
                            });
                            return Promise.resolve();
                        }
                    } catch (e) {
                        console.error('Failed to parse model details:', e);
                        return Promise.resolve();
                    }
                }
                return Promise.resolve();
            }).then(() => {
                // Step 3: Finally fetch images from Exactly
                fetchImages({
                    variables: {
                        styleUuid: styleUuid
                    }
                });
            }).catch(error => {
                console.error('Error in initialization flow:', error);
                // Still try to fetch images even if earlier steps fail
                fetchImages({
                    variables: {
                        styleUuid: styleUuid
                    }
                });
            });
        }
    }, [styleUuid, styleStatus]);

    // Watch for status changes and start/stop polling accordingly
    useEffect(() => {
        if (trainingStatus?.status === 'training') {
            // Start polling if not already polling
            if (!progressIntervalRef.current) {
                startProgressPolling();
            }
        } else {
            // Stop polling if training is complete or not training
            stopProgressPolling();
        }
    }, [trainingStatus?.status]);

    const [trainStyle, {loading: training}] = useMutation(TRAIN_EXACTLY_STYLE, {
        onCompleted: data => {
            if (data?.exactly?.trainStyle?.successful) {
                const response = data.exactly.trainStyle;
                try {
                    const result = JSON.parse(response.message);
                    setTrainingStatus({
                        jobId: result.jobId,
                        status: 'training',
                        progress: 0,
                        message: 'Training started'
                    });
                    // Immediately fetch the actual status from the API
                    getProgress({
                        variables: {
                            styleUuid: styleUuid
                        }
                    });
                    // Start polling for progress
                    startProgressPolling();
                } catch (e) {
                    console.error('Failed to parse training result:', e);
                    setTrainingStatus({
                        status: 'training',
                        progress: 0,
                        message: response.message
                    });
                    // Still fetch progress and start polling
                    getProgress({
                        variables: {
                            styleUuid: styleUuid
                        }
                    });
                    startProgressPolling();
                }
            } else {
                // Handle error response from backend
                const errorMsg = data?.exactly?.trainStyle?.message || 'Training failed';
                setTrainingStatus({
                    status: 'failed',
                    message: errorMsg
                });
                onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Training error:', error);
            const errorMsg = error.message || t('errors.trainingFailed');
            setTrainingStatus({
                status: 'failed',
                message: errorMsg
            });
            onError(errorMsg);
        }
    });

    const [uploadImages] = useMutation(UPLOAD_TRAINING_IMAGES, {
        onCompleted: data => {
            if (data?.exactly?.uploadTrainingImages?.successful) {
                setUploading(false);
                // Refetch existing images
                fetchImages({
                    variables: {
                        styleUuid: styleUuid
                    }
                });
            }
        },
        onError: error => {
            console.error('Upload error:', error);
            setUploading(false);
            onError(t('errors.uploadFailed', {message: error.message}));
        }
    });

    const [deleteImage] = useMutation(DELETE_TRAINING_IMAGE, {
        onCompleted: data => {
            if (data?.exactly?.deleteTrainingImage?.successful) {
                // Refetch existing images
                fetchImages({
                    variables: {
                        styleUuid: styleUuid
                    }
                });
            }
        },
        onError: error => {
            console.error('Delete error:', error);
            onError(t('errors.deleteFailed', {message: error.message}));
        }
    });

    const handleDeleteImage = (imageUid) => {
        setImageToDelete(imageUid);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteImage = () => {
        if (imageToDelete) {
            deleteTrainingImage({
                variables: {
                    styleUuid: styleUuid,
                    imageUid: imageToDelete
                }
            });
        }
        setDeleteDialogOpen(false);
        setImageToDelete(null);
    };

    const handleOpenMediaPicker = () => {
        window.CE_API.openPicker({
            type: 'image',
            site: window.jahiaGWTParameters?.siteKey || 'digitall',
            lang: window.jahiaGWTParameters?.uilang || 'en',
            isMultiple: true,
            setValue: (selectedItems) => {
                if (selectedItems && selectedItems.length > 0) {
                    const newAssets = selectedItems.filter(
                        item => item.uuid && !damAssets.includes(item.uuid)
                    );
                    
                    if (newAssets.length > 0) {
                        const newUuids = newAssets.map(item => item.uuid);
                        setDamAssets([...damAssets, ...newUuids]);
                        setSelectedAssets([...selectedAssets, ...newAssets]);
                    }
                }
            }
        });
    };

    const handleAddAsset = () => {
        const uuid = damAssetInput.trim();
        if (uuid && !damAssets.includes(uuid)) {
            setDamAssets([...damAssets, uuid]);
            setDamAssetInput('');
        }
    };

    const handleRemoveAsset = uuid => {
        setDamAssets(damAssets.filter(id => id !== uuid));
        setSelectedAssets(selectedAssets.filter(asset => asset.uuid !== uuid));
    };

    const handleUploadToExactly = () => {
        if (damAssets.length === 0) {
            onError(t('errors.noTrainingAssets'));
            return;
        }

        const siteKey = getSiteKey();
        setUploading(true);
        
        // Initialize progress for all images
        const initialProgress = {};
        damAssets.forEach(uuid => {
            initialProgress[uuid] = 0;
        });
        setUploadProgress(initialProgress);
        
        // Simulate progress (since GraphQL doesn't support real-time progress)
        // Start at 10% immediately, then increment
        damAssets.forEach(uuid => {
            initialProgress[uuid] = 10;
        });
        setUploadProgress({...initialProgress});
        
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
                const updated = {};
                Object.keys(prev).forEach(uuid => {
                    // Increment by 10% until 90%
                    updated[uuid] = Math.min(prev[uuid] + 10, 90);
                });
                return updated;
            });
        }, 500);
        
        uploadImages({
            variables: {
                styleUuid: styleUuid,
                damAssetUuids: damAssets
            }
        }).then(() => {
            clearInterval(progressInterval);
            // Set all to 100% on completion
            const completedProgress = {};
            damAssets.forEach(uuid => {
                completedProgress[uuid] = 100;
            });
            setUploadProgress(completedProgress);
        }).catch(() => {
            clearInterval(progressInterval);
        });
    };

    const handleStartTraining = () => {
        trainStyle({
            variables: {
                styleUuid: styleUuid
            }
        });
    };

    const [putToDraft] = useMutation(PUT_MODEL_TO_DRAFT, {
        onCompleted: data => {
            if (data?.exactly?.putModelToDraft?.successful) {
                // Clear training status and refetch progress
                setTrainingStatus(null);
                getProgress({
                    variables: {
                        styleUuid: styleUuid
                    }
                });
            } else {
                const errorMsg = data?.exactly?.putModelToDraft?.message || 'Failed to put model to draft';
                onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Put to draft error:', error);
            onError(error.message || 'Failed to put model to draft');
        }
    });

    const handlePutToDraft = () => {
        putToDraft({
            variables: {
                styleUuid: styleUuid
            }
        });
    };

    const [cancelTrain] = useMutation(CANCEL_TRAINING, {
        onCompleted: data => {
            if (data?.exactly?.cancelTraining?.successful) {
                stopProgressPolling();
                setTrainingStatus(prev => ({
                    ...prev,
                    status: 'canceled',
                    message: 'Training canceled'
                }));
                // Refetch progress to get updated status
                getProgress({
                    variables: {
                        styleUuid: styleUuid
                    }
                });
            } else {
                const errorMsg = data?.exactly?.cancelTraining?.message || 'Failed to cancel training';
                onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Cancel training error:', error);
            onError(error.message || 'Failed to cancel training');
        }
    });

    const handleCancelTraining = () => {
        cancelTrain({
            variables: {
                styleUuid: styleUuid
            }
        });
    };

    return (
        <div className="train-step">
            {/* Status Badge - Top Right */}
            {trainingStatus?.status && (
                <div className="train-step__ready-badge">
                    <StatusBadge status={trainingStatus.status} />
                </div>
            )}
            
            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
            >
                <DialogTitle>{t('actions.delete')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('train.confirmDelete')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        label={t('actions.cancel')}
                        variant="ghost"
                        onClick={() => setDeleteDialogOpen(false)}
                    />
                    <Button
                        label={t('actions.delete')}
                        color="danger"
                        onClick={confirmDeleteImage}
                    />
                </DialogActions>
            </Dialog>

            <div className="train-step__header">
                <Typography variant="title">{t('train.title')}</Typography>
                <Typography variant="body">{t('train.description')}</Typography>
                <div className="train-step__style-info">
                    <Typography variant="body">
                        {t('train.targetStyle')}: <strong>{styleName}</strong>
                    </Typography>
                    {styleDescription && (
                        <Typography variant="body" className="train-step__style-description">
                            {styleDescription}
                        </Typography>
                    )}
                </div>
            </div>

            {/* DAM Asset Selection */}
            <div className="train-step__section">
                <Typography variant="subheading">{t('train.selectAssets')}</Typography>
                
                {/* Existing images from Exactly.ai */}
                {loadingImages && (
                    <Typography variant="caption" className="train-step__note">
                        {t('train.loadingExisting')}
                    </Typography>
                )}
                
                {existingImages.length > 0 && (
                    <div className="train-step__existing-images">
                        <Typography variant="body" style={{marginBottom: '12px'}}>
                            {t('train.existingImages', {count: existingImages.length})}
                        </Typography>
                        <div className="train-step__thumbnails">
                            {existingImages.map((image, index) => (
                                <div key={image.id || index} className="train-step__thumbnail">
                                    <img 
                                        src={image.url} 
                                        alt={image.filename || `Training image ${index + 1}`}
                                        className="train-step__thumbnail-img"
                                        crossOrigin="anonymous"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="small"
                                        label="×"
                                        className="train-step__thumbnail-remove"
                                        onClick={() => handleDeleteImage(image.id)}
                                    />
                                    <div className="train-step__thumbnail-label">
                                        {image.filename}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="train-step__asset-input">
                    <Button
                        label={t('train.openMediaPicker')}
                        color="accent"
                        onClick={handleOpenMediaPicker}
                        disabled={styleStatus === 'training' || styleStatus === 'ready'}
                    />
                </div>

                {damAssets.length > 0 && (
                    <div className="train-step__asset-list">
                        <Typography variant="body">
                            {t('train.selectedAssets', {count: damAssets.length})}
                        </Typography>
                        <div className="train-step__thumbnails">
                            {selectedAssets.map(asset => (
                                <div key={asset.uuid} className="train-step__thumbnail">
                                    <img 
                                        src={`/files/default${asset.path}`} 
                                        alt={asset.name || asset.displayName}
                                        className="train-step__thumbnail-img"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="small"
                                        label="×"
                                        className="train-step__thumbnail-remove"
                                        onClick={() => handleRemoveAsset(asset.uuid)}
                                    />
                                    {uploadProgress[asset.uuid] !== undefined && (
                                        <div className="train-step__thumbnail-progress">
                                            <div 
                                                className="train-step__thumbnail-progress-bar"
                                                style={{width: `${uploadProgress[asset.uuid]}%`}}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Training Action */}
            <div className="train-step__actions">
                <Typography variant="caption" style={{fontStyle: 'italic', marginBottom: '12px', display: 'block'}}>
                    {t('train.imageSizeRequirement')}
                </Typography>
                <Button
                    label={uploading ? t('train.uploading') : t('train.uploadButton')}
                    icon={<CloudUpload />}
                    color="accent"
                    variant="outlined"
                    disabled={uploading || selectedAssets.length === 0 || styleStatus === 'training' || styleStatus === 'ready'}
                    onClick={handleUploadToExactly}
                />
                
                {/* Show different buttons based on model status */}
                {trainingStatus?.status === 'ready' ? (
                    <Button
                        label={t('train.putToDraft')}
                        color="default"
                        onClick={handlePutToDraft}
                    />
                ) : trainingStatus?.status === 'training' ? (
                    <Button
                        label={t('train.cancelTraining')}
                        color="danger"
                        onClick={handleCancelTraining}
                    />
                ) : (
                    <Button
                        label={training ? t('train.training') : t('train.startButton')}
                        disabled={training || existingImages.length === 0}
                        onClick={handleStartTraining}
                    />
                )}
            </div>

            {/* Training Status - Show when training */}
            {trainingStatus && trainingStatus.status === 'training' && (
                <div className="train-step__status">
                    <Typography variant="subheading">{t('train.statusTitle')}</Typography>
                    <div className="train-step__status-content">
                        {trainingStatus.jobId && (
                            <Typography variant="body">
                                {t('train.jobId')}: <code>{trainingStatus.jobId}</code>
                            </Typography>
                        )}
                        {trainingStatus.status && (
                            <Typography variant="body">
                                {t('train.status')}: <StatusBadge status={trainingStatus.status}/>
                            </Typography>
                        )}
                        
                        {/* Circular Progress Display */}
                        {trainingStatus.progress !== undefined && (
                            <div className="train-step__progress-container">
                                <CircularProgress progress={trainingStatus.progress} />
                                {trainingStatus.progress > 0 && trainingStatus.progress < 100 && (
                                    <Typography variant="body" className="train-step__progress-label">
                                        {t('train.progressLabel')}
                                    </Typography>
                                )}
                                {trainingStatus.progress === 100 && (
                                    <Typography variant="body" className="train-step__progress-label train-step__progress-complete">
                                        {t('train.complete')}
                                    </Typography>
                                )}
                            </div>
                        )}
                        
                        {trainingStatus.message && (
                            <Typography variant="caption" className="train-step__status-message">
                                {trainingStatus.message}
                            </Typography>
                        )}
                    </div>
                </div>
            )}

            
        </div>
    );
};

export default TrainStep;
