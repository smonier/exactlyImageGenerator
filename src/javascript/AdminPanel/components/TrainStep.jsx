/**
 * Step 2: Training - Refactored
 *
 * - Select DAM assets for training
 * - Start training job
 * - Display training status
 */

import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useMutation} from '@apollo/client';
import {Button, Typography, Loader} from '@jahia/moonstone';
import {CloudUpload} from '@jahia/moonstone/dist/icons';
import {Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from '@material-ui/core';

import {PUT_MODEL_TO_DRAFT, CANCEL_TRAINING, GET_MODEL, GET_TRAINING_PROGRESS} from '../../graphql/operations';
import {
    useTrainingProgress,
    useTrainingImages,
    useStartTraining,
    useUploadTrainingImages,
    useDeleteTrainingImage
} from '../../hooks/useTraining';
import {
    openImagePicker,
    filterNewAssets,
    normalizeAsset
} from '../../utils/pickerHelpers';
import {isCEAPIAvailable, getDefaultWorkspaceURL} from '../../utils/jahiaHelpers';
import {simulateProgress} from '../../utils/progressHelpers';
import {formatImageDimensions} from '../../utils/imageHelpers';
import {STATUS} from '../../utils/constants';
import {extractModelStatus, extractTrainingProgress} from '../../utils/responseParser';
import {isTraining as checkIfTraining, isTrainingComplete} from '../../utils/progressHelpers';

import StatusBadge from './StatusBadge';
import CircularProgress from './CircularProgress';
import './TrainStep.css';

const TrainStep = ({styleUuid, styleName, styleStatus, styleDescription, onTrainingStart, onError}) => {
    const {t} = useTranslation('exactlyImageGenerator');
    
    // Local state
    const [selectedAssets, setSelectedAssets] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [imageDimensions, setImageDimensions] = useState({});
    const [uploading, setUploading] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [imageToDelete, setImageToDelete] = useState(null);
    
    // Custom hooks for training operations
    const {trainingStatus, setTrainingStatus, startPolling, fetchProgress} = useTrainingProgress(styleUuid);
    const {images: existingImages, loading: loadingImages, refetch: refetchImages} = useTrainingImages(styleUuid);
    
    // Initialize training state
    const [getModel] = useMutation(GET_MODEL);
    
    useEffect(() => {
        if (!styleUuid) return;
        
        // Step 1: Fetch model details
        getModel({variables: {styleUuid}})
            .then(modelResult => {
                const modelStatus = extractModelStatus(modelResult.data);
                
                if (modelStatus && checkIfTraining(modelStatus.status)) {
                    // Step 2: If training, get progress
                    return fetchProgress().then(progressResult => {
                        const progress = extractTrainingProgress(progressResult.data);
                        if (progress) {
                            setTrainingStatus(progress);
                            if (!isTrainingComplete(progress.progress)) {
                                startPolling();
                            }
                        }
                    });
                } else if (modelStatus) {
                    // Not training, just set status
                    setTrainingStatus({
                        status: modelStatus.status,
                        progress: modelStatus.status === 'ready' ? 100 : 0
                    });
                }
                return Promise.resolve();
            })
            .then(() => {
                // Step 3: Fetch images
                refetchImages();
            })
            .catch(error => {
                console.error('Error in initialization flow:', error);
                refetchImages(); // Try to fetch images anyway
            });
    }, [styleUuid, styleStatus, getModel, fetchProgress, setTrainingStatus, startPolling, refetchImages]);
    
    // Training operations
    const {startTraining, loading: training} = useStartTraining(
        styleUuid,
        () => {
            // On success, set training status and start polling
            setTrainingStatus({
                status: STATUS.TRAINING,
                progress: 0,
                message: 'Training started'
            });
            fetchProgress();
            startPolling();
            if (onTrainingStart) onTrainingStart();
            refetchImages();
        },
        onError
    );
    
    // Upload operations with progress simulation
    const uploadImagesHook = useUploadTrainingImages(
        styleUuid,
        () => {
            setUploading(false);
            setUploadProgress({});
            setSelectedAssets([]);
            refetchImages(); // Refresh image list from Exactly.ai
        },
        (error) => {
            setUploading(false);
            onError(t('errors.uploadFailed', {message: error.message}));
        }
    );
    
    // Delete operations
    const {deleteTrainingImage} = useDeleteTrainingImage(
        styleUuid,
        () => refetchImages(), // Refresh image list after delete
        (error) => onError(t('errors.deleteFailed', {message: error.message}))
    );
    
    // Draft and cancel mutations
    const [putToDraft] = useMutation(PUT_MODEL_TO_DRAFT, {
        onCompleted: data => {
            if (data?.exactly?.putModelToDraft?.successful) {
                setTrainingStatus(null);
                refetchImages();
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
    
    const [cancelTrain] = useMutation(CANCEL_TRAINING, {
        onCompleted: data => {
            if (data?.exactly?.cancelTraining?.successful) {
                setTrainingStatus(prev => ({
                    ...prev,
                    status: 'canceled',
                    message: 'Training canceled'
                }));
                refetchImages();
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
    
    // Handlers
    const handleOpenMediaPicker = useCallback(() => {
        if (!isCEAPIAvailable()) {
            onError('Content Editor API is not available');
            return;
        }
        
        openImagePicker((selectedItems) => {
            const currentUuids = selectedAssets.map(a => a.uuid);
            const newAssets = filterNewAssets(selectedItems, currentUuids)
                .map(normalizeAsset);
            
            if (newAssets.length > 0) {
                setSelectedAssets(prev => [...prev, ...newAssets]);
            }
        }, true);
    }, [selectedAssets, onError]);
    
    const handleRemoveAsset = useCallback((uuid) => {
        setSelectedAssets(prev => prev.filter(asset => asset.uuid !== uuid));
    }, []);
    
    const handleUploadToExactly = useCallback(() => {
        if (selectedAssets.length === 0) {
            onError(t('errors.noTrainingAssets'));
            return;
        }
        
        setUploading(true);
        
        // Simulate progress
        const progressController = simulateProgress(
            selectedAssets,
            setUploadProgress,
            null
        );
        
        // Perform actual upload
        const assetUuids = selectedAssets.map(a => a.uuid);
        uploadImagesHook.upload(assetUuids)
            .then(() => {
                progressController.complete();
            })
            .catch(() => {
                progressController.stop();
                setUploading(false);
            });
    }, [selectedAssets, uploadImagesHook, onError, t]);
    
    const handleStartTraining = useCallback(() => {
        startTraining();
    }, [startTraining]);
    
    const handlePutToDraft = useCallback(() => {
        putToDraft({variables: {styleUuid}});
    }, [putToDraft, styleUuid]);
    
    const handleCancelTraining = useCallback(() => {
        cancelTrain({variables: {styleUuid}});
    }, [cancelTrain, styleUuid]);
    
    const handleDeleteImage = useCallback((imageUid) => {
        setImageToDelete(imageUid);
        setDeleteDialogOpen(true);
    }, []);
    
    const confirmDeleteImage = useCallback(() => {
        if (imageToDelete) {
            deleteTrainingImage(imageToDelete);
        }
        setDeleteDialogOpen(false);
        setImageToDelete(null);
    }, [imageToDelete, deleteTrainingImage]);
    
    const handleImageLoad = useCallback((e, assetUuid) => {
        const img = e.target;
        setImageDimensions(prev => ({
            ...prev,
            [assetUuid]: {
                width: img.naturalWidth,
                height: img.naturalHeight
            }
        }));
    }, []);
    
    // Computed values
    const isTrainingOrReady = useMemo(() => {
        return styleStatus === STATUS.TRAINING || styleStatus === STATUS.READY;
    }, [styleStatus]);
    
    const shouldShowSizeRequirement = useMemo(() => {
        return selectedAssets.length > 0 && 
               !isTrainingOrReady && 
               !uploading;
    }, [selectedAssets.length, isTrainingOrReady, uploading]);
    
    const canUpload = useMemo(() => {
        return !uploading && 
               selectedAssets.length > 0 && 
               !isTrainingOrReady;
    }, [uploading, selectedAssets.length, isTrainingOrReady]);
    
    const canStartTraining = useMemo(() => {
        return !training && existingImages.length > 0;
    }, [training, existingImages.length]);
    
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
                        disabled={isTrainingOrReady}
                    />
                </div>

                {selectedAssets.length > 0 && (
                    <div className="train-step__asset-list">
                        <Typography variant="body">
                            {t('train.selectedAssets', {count: selectedAssets.length})}
                        </Typography>
                        <div className="train-step__thumbnails">
                            {selectedAssets.map(asset => (
                                <div key={asset.uuid} className="train-step__thumbnail">
                                    <img 
                                        src={getDefaultWorkspaceURL(asset.path)} 
                                        alt={asset.name}
                                        className="train-step__thumbnail-img"
                                        onLoad={(e) => handleImageLoad(e, asset.uuid)}
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
                                    <div className="train-step__thumbnail-label">
                                        {asset.name}
                                        {imageDimensions[asset.uuid] && (
                                            <div style={{fontSize: '11px', color: '#666', marginTop: '2px'}}>
                                                {formatImageDimensions(
                                                    imageDimensions[asset.uuid].width,
                                                    imageDimensions[asset.uuid].height
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {shouldShowSizeRequirement && (
                    <>
                        <Typography variant="caption" style={{fontStyle: 'italic', marginBottom: '12px', display: 'block'}}>
                            {t('train.imageSizeRequirement')}
                        </Typography>
                        <br/>
                    </>
                )}
            </div>

            {/* Training Action */}
            <div className="train-step__actions">
                <Button
                    label={uploading ? t('train.uploading') : t('train.uploadButton')}
                    icon={<CloudUpload />}
                    color="accent"
                    variant="outlined"
                    disabled={!canUpload}
                    onClick={handleUploadToExactly}
                />
                {uploading && <Loader size="small" style={{display: 'inline-block'}}/>}
                {/* Show different buttons based on model status */}
                {trainingStatus?.status === STATUS.READY ? (
                    <Button
                        label={t('train.putToDraft')}
                        color="default"
                        onClick={handlePutToDraft}
                    />
                ) : trainingStatus?.status === STATUS.TRAINING ? (
                    <Button
                        label={t('train.cancelTraining')}
                        color="danger"
                        onClick={handleCancelTraining}
                    />
                ) : (
                    <Button
                        label={training ? t('train.training') : t('train.startButton')}
                        disabled={!canStartTraining}
                        onClick={handleStartTraining}
                    />
                )}
            </div>

            {/* Training Status - Show when training */}
            {trainingStatus && trainingStatus.status === STATUS.TRAINING && (
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
