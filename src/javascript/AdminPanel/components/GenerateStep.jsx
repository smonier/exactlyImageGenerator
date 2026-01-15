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
    const [targetFolder, setTargetFolder] = useState('/sites/systemsite/files/exactly-generated');
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [savedAssets, setSavedAssets] = useState([]);
    
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

            {/* Generate Button */}
            <div className="generate-step__actions">
                <Button
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
