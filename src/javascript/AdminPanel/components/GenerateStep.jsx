/**
 * Step 3: Generate & Save
 *
 * - Enter prompt and params
 * - Generate images
 * - Preview generated images
 * - Select and save to DAM
 */

import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useMutation} from '@apollo/client';
import {Button, Typography, Input, Loader, Checkbox} from '@jahia/moonstone';
import {Star} from '@jahia/moonstone/dist/icons';

import {GENERATE_EXACTLY_IMAGES, SAVE_GENERATED_IMAGES_TO_DAM} from '../../graphql/operations';
import './GenerateStep.css';

// Get current site key from Jahia context
const getSiteKey = () => {
    return window.contextJsParameters?.siteKey || 'systemsite';
};

const GenerateStep = ({styleUuid, styleName, generatedUrls, onGenerationComplete, onError}) => {
    const {t} = useTranslation('exactlyImageGenerator');
    const [prompt, setPrompt] = useState('');
    const [numVariations, setNumVariations] = useState(4);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [projectUuid, setProjectUuid] = useState(null);
    const [selectedImages, setSelectedImages] = useState([]);
    const siteKey = getSiteKey();
    const [targetFolder, setTargetFolder] = useState(`/sites/${siteKey}/files/exactly-generated`);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [savedAssets, setSavedAssets] = useState([]);
    const [useReferenceImages, setUseReferenceImages] = useState(false);
    const [referenceImages, setReferenceImages] = useState([]);
    
    // Convert aspect ratio to pixel dimensions
    const aspectRatioToSize = (ratio) => {
        const ratioMap = {
            '9:16': [576, 1024],
            '2:3': [683, 1024],
            '3:4': [768, 1024],
            '1:1': [1024, 1024],
            '4:3': [1024, 768],
            '3:2': [1024, 683],
            '16:9': [1024, 576]
        };
        return ratioMap[ratio] || [1024, 1024];
    };

    const [generateImages, {loading: generating}] = useMutation(GENERATE_EXACTLY_IMAGES, {
        onCompleted: data => {
            if (data?.exactly?.generateImages?.successful) {
                const response = data.exactly.generateImages;
                try {
                    const result = JSON.parse(response.message);
                    const urls = result.urls || [];
                    const jobId = result.jobId;
                    
                    setProjectUuid(jobId);
                    onGenerationComplete(jobId, urls);
                    // Select all by default
                    setSelectedImages(urls.map((_, idx) => idx));
                } catch (e) {
                    console.error('Failed to parse generation result:', e);
                    onError(t('errors.generationFailed', {message: response.message}));
                }
            } else {
                const errorMsg = data?.exactly?.generateImages?.message || 'Generation failed';
                onError(t('errors.generationFailed', {message: errorMsg}));
            }
        },
        onError: error => {
            console.error('Generation error:', error);
            onError(t('errors.generationFailed', {message: error.message}));
        }
    });

    const [saveToDam, {loading: saving}] = useMutation(SAVE_GENERATED_IMAGES_TO_DAM, {
        onCompleted: data => {
            if (data?.exactly?.saveGeneratedImagesToDam?.successful) {
                // Success - can show message or confirmation
                console.log('Images saved successfully');
            } else {
                const errorMsg = data?.exactly?.saveGeneratedImagesToDam?.message || 'Save failed';
                onError(t('errors.saveFailed', {message: errorMsg}));
            }
        },
        onError: error => {
            console.error('Save error:', error);
            onError(t('errors.saveFailed', {message: error.message}));
        }
    });

    const handleGenerate = () => {
        if (!prompt.trim()) {
            onError(t('errors.noPrompt'));
            return;
        }

        // Build params from selections
        const size = aspectRatioToSize(aspectRatio);
        const params = {
            num_images: numVariations,
            size: size
        };

        // Add reference images if enabled
        if (useReferenceImages && referenceImages.length > 0) {
            params.reference_images = referenceImages.map(ref => ({
                base64: ref.base64,
                purpose: ref.purpose,
                ...(ref.purpose === 'sketch' && ref.strength !== undefined ? {strength: ref.strength} : {})
            }));
        }

        generateImages({
            variables: {
                styleUuid: styleUuid,
                prompt: prompt,
                params: JSON.stringify(params)
            }
        });
    };

    const handleImageToggle = index => {
        setSelectedImages(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            }

            return [...prev, index];
        });
    };

    const handleOpenFolderPicker = () => {
        window.CE_API.openPicker({
            type: 'folder',
            site: window.jahiaGWTParameters?.siteKey || 'digitall',
            lang: window.jahiaGWTParameters?.uilang || 'en',
            isMultiple: false,
            setValue: (selectedItems) => {
                if (selectedItems && selectedItems.length > 0) {
                    const folder = selectedItems[0];
                    setSelectedFolder(folder);
                    setTargetFolder(folder.path || folder.url);
                }
            }
        });
    };

    const handleSaveToDam = () => {
        if (selectedImages.length === 0) {
            onError(t('errors.noSelection'));
            return;
        }

        const selection = selectedImages.map(idx => ({
            remoteUrl: generatedUrls[idx],
            fileName: `generated-${Date.now()}-${idx}.png`,
            title: `Generated: ${prompt.substring(0, 50)}`
        }));

        saveToDam({
            variables: {
                projectUuid: projectUuid,
                folderPath: targetFolder,
                selectionJson: JSON.stringify(selection)
            }
        });
    };

    const handleAddReferenceImage = () => {
        window.CE_API.openPicker({
            type: 'image',
            site: window.jahiaGWTParameters?.siteKey || 'digitall',
            lang: window.jahiaGWTParameters?.uilang || 'en',
            isMultiple: false,
            setValue: async (selectedItems) => {
                if (selectedItems && selectedItems.length > 0) {
                    const asset = selectedItems[0];
                    console.log('Selected asset:', asset);
                    try {
                        // Construct URL for default workspace to access unpublished content
                        // Replace /sites/ with /files/default/ or use the path property
                        let imageUrl = asset.url || asset.path || asset.downloadUrl;
                        
                        // If URL contains /sites/, replace with /files/default/ to access unpublished content
                        if (imageUrl.includes('/sites/')) {
                            imageUrl = imageUrl.replace('/sites/', '/files/default/sites/');
                        }
                        
                        console.log('Fetching image from:', imageUrl);
                        
                        // Fetch the image with credentials to handle authentication
                        const response = await fetch(imageUrl, {
                            credentials: 'include',
                            headers: {
                                'Accept': 'image/*'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        
                        const contentType = response.headers.get('content-type');
                        console.log('Response content-type:', contentType);
                        
                        // Check if we actually got an image
                        if (contentType && !contentType.startsWith('image/')) {
                            throw new Error(`Expected image but got ${contentType}`);
                        }
                        
                        const blob = await response.blob();
                        
                        // Check file size limit (2.5 MB)
                        const maxSizeBytes = 2.5 * 1024 * 1024; // 2.5 MB
                        if (blob.size > maxSizeBytes) {
                            const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                            throw new Error(`Image size (${sizeMB} MB) exceeds the maximum allowed size of 2.5 MB. Please select a smaller image.`);
                        }
                        
                        // Determine the image mime type from the file extension or content-type
                        let mimeType = contentType || 'image/png';
                        if (!mimeType.startsWith('image/')) {
                            const fileName = asset.name || asset.displayName || '';
                            if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
                                mimeType = 'image/jpeg';
                            } else if (fileName.toLowerCase().endsWith('.png')) {
                                mimeType = 'image/png';
                            } else if (fileName.toLowerCase().endsWith('.gif')) {
                                mimeType = 'image/gif';
                            } else if (fileName.toLowerCase().endsWith('.webp')) {
                                mimeType = 'image/webp';
                            } else {
                                mimeType = 'image/png'; // default
                            }
                        }
                        
                        // Create a new blob with the correct mime type
                        const imageBlob = new Blob([blob], { type: mimeType });
                        
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            // reader.result is the full data URL: "data:image/png;base64,iVBORw0KGgo..."
                            const dataUrl = reader.result;
                            console.log('Data URL mime type:', dataUrl.substring(0, 30));
                            
                            // Extract just the base64 part (after the comma) for API
                            const base64Only = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                            
                            setReferenceImages(prev => [...prev, {
                                uuid: asset.uuid,
                                name: asset.name || asset.displayName,
                                url: asset.url,
                                previewUrl: dataUrl,    // For display: full data URL
                                base64: base64Only,     // For API: only base64 string
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
            }
        });
    };

    const handleRemoveReferenceImage = (index) => {
        setReferenceImages(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleUpdateReferenceImagePurpose = (index, purpose) => {
        setReferenceImages(prev => prev.map((ref, idx) => 
            idx === index ? {...ref, purpose} : ref
        ));
    };

    const handleUpdateReferenceImageStrength = (index, strength) => {
        setReferenceImages(prev => prev.map((ref, idx) => 
            idx === index ? {...ref, strength: parseFloat(strength)} : ref
        ));
    };

    return (
        <div className="generate-step">
            <div className="generate-step__header">
                <Typography variant="title">{t('generate.title')}</Typography>
                <Typography variant="body">{t('generate.description')}</Typography>
                <Typography variant="body" className="generate-step__style-info">
                    {t('generate.usingStyle')}: <strong>{styleName}</strong>
                </Typography>
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
                                        size="compact"
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
                    disabled={generating || !prompt.trim()}
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
                                    checked={selectedImages.includes(idx)}
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
                                disabled={saving || selectedImages.length === 0}
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
