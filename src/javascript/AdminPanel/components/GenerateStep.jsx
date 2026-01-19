/**
 * Step 3: Generate & Save - Refactored
 *
 * - Enter prompt and params
 * - Generate images
 * - Preview generated images
 * - Select and save to DAM
 */

import React, {useState, useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Typography, Input, Loader, Checkbox} from '@jahia/moonstone';
import {Delete, Star} from '@jahia/moonstone/dist/icons';

import {
    useGenerateImages,
    useSaveToDAM,
    useImageSelection
} from '../../hooks/useGeneration';
import {openImagePicker, openFolderPicker} from '../../utils/pickerHelpers';
import {isCEAPIAvailable, getSiteKey, getDefaultTargetFolder} from '../../utils/jahiaHelpers';
import {imageUrlToBase64} from '../../utils/imageHelpers';
import {DEFAULTS} from '../../utils/constants';

import './GenerateStep.css';

const GenerateStep = ({styleUuid, styleName, styleDescription, generatedUrls, onGenerationComplete, onError}) => {
    const {t} = useTranslation('exactlyImageGenerator');
    
    // Form state
    const [prompt, setPrompt] = useState('');
    const [numVariations, setNumVariations] = useState(DEFAULTS.NUM_VARIATIONS);
    const [aspectRatio, setAspectRatio] = useState(DEFAULTS.ASPECT_RATIO);
    const [targetFolder, setTargetFolder] = useState(getDefaultTargetFolder(getSiteKey()));
    
    // Reference images state
    const [useReferenceImages, setUseReferenceImages] = useState(false);
    const [referenceImages, setReferenceImages] = useState([]);
    
    // Custom hooks
    const {generate, loading: generating, projectUuid} = useGenerateImages(
        styleUuid,
        (jobId, urls) => {
            onGenerationComplete(jobId, urls);
            selectAll(urls.length);
        },
        onError
    );
    
    const {save, loading: saving, savedAssets, setSavedAssets} = useSaveToDAM(
        () => console.log('Images saved successfully'),
        onError
    );
    
    const {selectedImages, toggleImage, selectAll, isSelected} = useImageSelection();
    
    // Handlers
    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) {
            onError(t('errors.noPrompt'));
            return;
        }
        
        const refImages = useReferenceImages ? referenceImages : [];
        generate(prompt, numVariations, aspectRatio, refImages);
    }, [prompt, numVariations, aspectRatio, useReferenceImages, referenceImages, generate, onError, t]);
    
    const handleImageToggle = useCallback((index) => {
        toggleImage(index);
    }, [toggleImage]);
    
    const handleOpenFolderPicker = useCallback(() => {
        if (!isCEAPIAvailable()) {
            onError('Content Editor API is not available');
            return;
        }
        
        openFolderPicker((selectedItems) => {
            if (selectedItems && selectedItems.length > 0) {
                const folder = selectedItems[0];
                setTargetFolder(folder.path || folder.url);
            }
        });
    }, [onError]);
    
    const handleSaveToDam = useCallback(() => {
        if (selectedImages.length === 0) {
            onError(t('errors.noSelection'));
            return;
        }
        
        save(projectUuid, selectedImages, generatedUrls, targetFolder, prompt);
    }, [selectedImages, projectUuid, generatedUrls, targetFolder, prompt, save, onError, t]);
    
    const handleAddReferenceImage = useCallback(async () => {
        if (!isCEAPIAvailable()) {
            onError('Content Editor API is not available. Please make sure you are in the Jahia administration interface.');
            return;
        }
        
        openImagePicker(async (selectedItems) => {
            if (selectedItems && selectedItems.length > 0) {
                const asset = selectedItems[0];
                
                try {
                    // Get image URL
                    let imageUrl = asset.url || asset.path || asset.downloadUrl;
                    if (imageUrl.includes('/sites/')) {
                        imageUrl = imageUrl.replace('/sites/', '/files/default/sites/');
                    }
                    
                    // Fetch and convert to base64
                    const response = await fetch(imageUrl, {
                        credentials: 'include',
                        headers: {'Accept': 'image/*'}
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const contentType = response.headers.get('content-type');
                    if (contentType && !contentType.startsWith('image/')) {
                        throw new Error(`Expected image but got ${contentType}`);
                    }
                    
                    const blob = await response.blob();
                    
                    // Check file size limit (2.5 MB)
                    const maxSizeBytes = 2.5 * 1024 * 1024;
                    if (blob.size > maxSizeBytes) {
                        const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                        throw new Error(`Image size (${sizeMB} MB) exceeds the maximum allowed size of 2.5 MB. Please select a smaller image.`);
                    }
                    
                    // Determine mime type
                    let mimeType = contentType || 'image/png';
                    if (!mimeType.startsWith('image/')) {
                        const fileName = asset.name || asset.displayName || '';
                        const ext = fileName.toLowerCase().split('.').pop();
                        const mimeMap = {
                            'jpg': 'image/jpeg',
                            'jpeg': 'image/jpeg',
                            'png': 'image/png',
                            'gif': 'image/gif',
                            'webp': 'image/webp'
                        };
                        mimeType = mimeMap[ext] || 'image/png';
                    }
                    
                    const imageBlob = new Blob([blob], {type: mimeType});
                    
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = reader.result;
                        const base64Only = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                        
                        setReferenceImages(prev => [...prev, {
                            uuid: asset.uuid,
                            name: asset.name || asset.displayName,
                            url: asset.url,
                            previewUrl: dataUrl,
                            base64: base64Only,
                            purpose: 'reference',
                            strength: 0.5
                        }]);
                    };
                    reader.readAsDataURL(imageBlob);
                } catch (error) {
                    console.error('Failed to load reference image:', error);
                    onError('Failed to load reference image: ' + error.message);
                }
            }
        }, false);
    }, [onError]);
    
    const handleRemoveReferenceImage = useCallback((index) => {
        setReferenceImages(prev => prev.filter((_, idx) => idx !== index));
    }, []);
    
    const handleUpdateReferenceImagePurpose = useCallback((index, purpose) => {
        setReferenceImages(prev => prev.map((ref, idx) => 
            idx === index ? {...ref, purpose} : ref
        ));
    }, []);
    
    const handleUpdateReferenceImageStrength = useCallback((index, strength) => {
        setReferenceImages(prev => prev.map((ref, idx) => 
            idx === index ? {...ref, strength: parseFloat(strength)} : ref
        ));
    }, []);
    
    // Computed values
    const canGenerate = useMemo(() => {
        return !generating && prompt.trim().length > 0;
    }, [generating, prompt]);
    
    const canSave = useMemo(() => {
        return !saving && selectedImages.length > 0;
    }, [saving, selectedImages.length]);
    
    return (
        <div className="generate-step">
            <div className="generate-step__header">
                <Typography variant="title">{t('generate.title')}</Typography>
                <Typography variant="body">{t('generate.description')}</Typography>
                <Typography variant="body" className="generate-step__style-info">
                    {t('generate.usingStyle')}: <strong>{styleName}</strong>
                </Typography>
                {styleDescription && (
                    <Typography variant="body" className="generate-step__style-description">
                        {styleDescription}
                    </Typography>
                )}
            </div>

            {/* Prompt Section */}
            <div className="generate-step__section">
                <Typography variant="subheading">{t('generate.promptLabel')}</Typography>
                <textarea
                    className="generate-step__prompt"
                    value={prompt}
                    placeholder={t('generate.promptPlaceholder')}
                    rows={4}
                    disabled={generating}
                    onChange={e => setPrompt(e.target.value)}
                />
            </div>

            {/* Generation Options */}
            <div className="generate-step__section">
                <Typography variant="subheading">{t('generate.optionsLabel')}</Typography>
                
                <div className="generate-step__options">
                    <div className="generate-step__option">
                        <Typography variant="body">{t('generate.numVariationsLabel')}</Typography>
                        <select
                            className="generate-step__select"
                            value={numVariations}
                            disabled={generating}
                            onChange={e => setNumVariations(parseInt(e.target.value))}
                        >
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </select>
                    </div>
                    
                    <div className="generate-step__option">
                        <Typography variant="body">{t('generate.aspectRatioLabel')}</Typography>
                        <select
                            className="generate-step__select"
                            value={aspectRatio}
                            disabled={generating}
                            onChange={e => setAspectRatio(e.target.value)}
                        >
                            <option value="9:16">9:16 (Portrait)</option>
                            <option value="2:3">2:3 (Portrait)</option>
                            <option value="3:4">3:4 (Portrait)</option>
                            <option value="1:1">1:1 (Square)</option>
                            <option value="4:3">4:3 (Landscape)</option>
                            <option value="3:2">3:2 (Landscape)</option>
                            <option value="16:9">16:9 (Landscape)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Reference Images Section */}
            <div className="generate-step__section">
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                    <Checkbox
                        checked={useReferenceImages}
                        onChange={() => setUseReferenceImages(!useReferenceImages)}
                    />
                    <Typography variant="subheading">{t('generate.useReferenceImages')}</Typography>
                </div>
                <Typography variant="caption">{t('generate.referenceImagesNote')}</Typography>

                {useReferenceImages && (
                    <div className="generate-step__reference-images" style={{marginTop: '16px'}}>
                        {referenceImages.map((ref, index) => (
                            <div key={index} className="generate-step__reference-image" style={{
                                border: '1px solid #ddd',
                                padding: '12px',
                                marginBottom: '12px',
                                borderRadius: '4px'
                            }}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                    <Typography variant="body">
                                        {t('generate.referenceImage', {index: index + 1})}
                                    </Typography>
                                    <Button
                                        label={t('generate.removeReferenceImage')}
                                        icon={<Delete/>}
                                        color="danger"
                                        size="default"
                                        variant="ghost"
                                        onClick={() => handleRemoveReferenceImage(index)}
                                    />
                                </div>
                                <div style={{marginBottom: '8px'}}>
                                    <Typography variant="caption">{ref.name}</Typography>
                                    {(ref.previewUrl || ref.url) && (
                                        <img
                                            src={ref.previewUrl || ref.url}
                                            alt={ref.name}
                                            style={{
                                                maxWidth: '200px',
                                                maxHeight: '200px',
                                                marginTop: '8px',
                                                borderRadius: '4px',
                                                display: 'block'
                                            }}
                                            onError={(e) => {
                                                console.error('Failed to load image preview');
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    )}
                                </div>

                                <div className="generate-step__option" style={{marginBottom: '8px'}}>
                                    <Typography variant="body">{t('generate.referenceImagePurpose')}</Typography>
                                    <select
                                        className="generate-step__select"
                                        value={ref.purpose}
                                        disabled={generating}
                                        onChange={e => handleUpdateReferenceImagePurpose(index, e.target.value)}
                                        style={{marginTop: '4px'}}
                                    >
                                        <option value="sketch">{t('generate.purposeSketch')}</option>
                                        <option value="style">{t('generate.purposeStyle')}</option>
                                        <option value="reference">{t('generate.purposeReference')}</option>
                                        <option value="instruct">{t('generate.purposeInstruct')}</option>
                                        <option value="product">{t('generate.purposeProduct')}</option>
                                        <option value="character">{t('generate.purposeCharacter')}</option>
                                    </select>
                                </div>

                                {ref.purpose === 'sketch' && (
                                    <div className="generate-step__option">
                                        <Typography variant="body">{t('generate.strengthLabel')}</Typography>
                                        <Typography variant="caption">{t('generate.strengthNote')}</Typography>
                                        <input
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={ref.strength}
                                            disabled={generating}
                                            onChange={e => handleUpdateReferenceImageStrength(index, e.target.value)}
                                            style={{
                                                marginTop: '4px',
                                                padding: '8px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                width: '100px'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}

                        <Button
                            label={t('generate.addReferenceImage')}
                            size="default"
                            variant="outlined"
                            disabled={generating}
                            onClick={handleAddReferenceImage}
                        />
                    </div>
                )}
            </div>

            {/* Generate Button */}
            <div className="generate-step__actions">
                <Button
                    icon={<Star />}
                    label={generating ? t('generate.generating') : t('generate.generateButton')}
                    disabled={!canGenerate}
                    onClick={handleGenerate}
                />
                {generating && <Loader size="small" style={{marginLeft: '8px', display: 'inline-block'}}/>}
            </div>

            {/* Generated Images Preview */}
            {generatedUrls.length > 0 && (
                <div className="generate-step__results">
                    <Typography variant="subheading">
                        {t('generate.resultsTitle', {count: generatedUrls.length})}
                    </Typography>

                    <div className="generate-step__gallery">
                        {generatedUrls.map((url, idx) => (
                            <div key={idx} className="generate-step__image-card">
                                <Checkbox
                                    checked={isSelected(idx)}
                                    className="generate-step__checkbox"
                                    onChange={() => handleImageToggle(idx)}
                                />
                                <img
                                    src={url}
                                    alt={`Generated ${idx + 1}`}
                                    className="generate-step__image"
                                    onError={e => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                                <div className="generate-step__image-fallback" style={{display: 'none'}}>
                                    <Typography variant="caption">{t('generate.previewUnavailable')}</Typography>
                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                        {t('generate.openExternal')}
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Save to DAM Section */}
                    <div className="generate-step__save-section">
                        <Typography variant="subheading">{t('generate.saveTitle')}</Typography>
                        <Typography variant="caption">{t('generate.saveNote')}</Typography>

                        <div className="generate-step__folder-input">
                            <Typography variant="body">{t('generate.targetFolder')}</Typography>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px'}}>
                                <Input
                                    value={targetFolder}
                                    placeholder="/sites/systemsite/files/exactly-generated"
                                    readOnly
                                    style={{flex: 1}}
                                />
                                <Button
                                    label={t('generate.selectFolder')}
                                    size="default"
                                    onClick={handleOpenFolderPicker}
                                />
                            </div>
                        </div>

                        <div style={{marginTop: '16px'}}>
                            <Button
                                label={saving ? t('generate.saving') : t('generate.saveButton', {count: selectedImages.length})}
                                disabled={!canSave}
                                onClick={handleSaveToDam}
                            />
                            {saving && <Loader size="small" style={{marginLeft: '8px', display: 'inline-block'}}/>}
                        </div>
                    </div>

                    {/* Saved Assets */}
                    {savedAssets.length > 0 && (
                        <div className="generate-step__saved">
                            <Typography variant="subheading">
                                {t('generate.savedTitle', {count: savedAssets.length})}
                            </Typography>
                            <div className="generate-step__asset-list">
                                {savedAssets.map(asset => (
                                    <div key={asset.uuid} className="generate-step__asset-item">
                                        <Typography variant="body">
                                            ✓ {asset.name}
                                        </Typography>
                                        <Typography variant="caption" className="generate-step__asset-path">
                                            {asset.path}
                                        </Typography>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GenerateStep;
