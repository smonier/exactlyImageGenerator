/**
 * Step 1: Style Selection
 *
 * - Sync styles from Exactly API
 * - Display list of available styles
 * - Select a style to use for training/generation
 */

import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useMutation, useQuery} from '@apollo/client';
import {Button, Typography, Loader, Input} from '@jahia/moonstone';
import {Delete, Reload} from '@jahia/moonstone/dist/icons';
import {Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from '@material-ui/core';
import {SYNC_EXACTLY_STYLES, CREATE_EXACTLY_STYLE, DELETE_EXACTLY_STYLE, GET_STYLES, GET_TRAINING_PROGRESS} from '../../graphql/operations';
import StatusBadge from './StatusBadge';
import './StyleStep.css';

// Get current site key from Jahia context
const getSiteKey = () => {
    return window.contextJsParameters?.siteKey || 'systemsite';
};

const StyleStep = ({selectedStyleUuid, selectedStyleName, onStyleSelect, onError}) => {
    const {t} = useTranslation('exactlyImageGenerator');
    const [styles, setStyles] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newStyleName, setNewStyleName] = useState('');
    const [newStyleDescription, setNewStyleDescription] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [styleToDelete, setStyleToDelete] = useState(null);
    const [trainingProgress, setTrainingProgress] = useState({}); // Track progress per style UUID

    // Build the path for the current site
    const siteKey = getSiteKey();
    const stylesPath = `/sites/${siteKey}/contents/exactly-styles`;

    // Query styles from JCR
    const {data: jcrData, loading: jcrLoading, refetch} = useQuery(GET_STYLES, {
        variables: {path: stylesPath},
        onError: error => {
            console.error('Error loading styles:', error);
            onError(t('errors.loadStylesFailed'));
        }
    });

    // Sync mutation - uses site node as context
    const [syncStyles, {loading: syncing}] = useMutation(SYNC_EXACTLY_STYLES, {
        onCompleted: data => {
            if (data?.exactly?.syncStyles?.successful) {
                refetch(); // Refresh the list
            } else {
                const errorMsg = data?.exactly?.syncStyles?.message || 'Sync failed';
                onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Sync error:', error);
            onError(t('errors.syncFailed', {message: error.message}));
        }
    });

    // Create mutation
    const [createStyle, {loading: creating}] = useMutation(CREATE_EXACTLY_STYLE, {
        onCompleted: data => {
            if (data?.exactly?.createStyle?.successful) {
                setShowCreateForm(false);
                setNewStyleName('');
                setNewStyleDescription('');
                refetch(); // Refresh the list
            } else {
                const errorMsg = data?.exactly?.createStyle?.message || 'Create failed';
                onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Create error:', error);
            onError(t('errors.createFailed', {message: error.message}));
        }
    });

    // Delete mutation
    const [deleteStyle, {loading: deleting}] = useMutation(DELETE_EXACTLY_STYLE, {
        onCompleted: data => {
            if (data?.exactly?.deleteStyle?.successful) {
                refetch(); // Refresh the list
            } else {
                const errorMsg = data?.exactly?.deleteStyle?.message || 'Delete failed';
                onError(errorMsg);
            }
        },
        onError: error => {
            console.error('Delete error:', error);
            onError(t('errors.deleteFailed', {message: error.message}));
        }
    });

    // Get training progress mutation
    const [getProgress] = useMutation(GET_TRAINING_PROGRESS);

    const handleSync = () => {
        syncStyles({
            variables: {
                siteKey: siteKey
            }
        });
    };

    // Auto-sync on component mount to update status
    useEffect(() => {
        handleSync();
    }, []); // Empty dependency array = run once on mount

    const handleCreate = () => {
        if (!newStyleName.trim()) {
            onError('Style name is required');
            return;
        }

        createStyle({
            variables: {
                siteKey: siteKey,
                name: newStyleName.trim(),
                description: newStyleDescription.trim() || null
            }
        });
    };

    const handleDelete = (styleUuid, styleName) => {
        setStyleToDelete({uuid: styleUuid, name: styleName});
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (styleToDelete) {
            deleteStyle({
                variables: {
                    styleUuid: styleToDelete.uuid
                }
            });
        }
        setDeleteDialogOpen(false);
        setStyleToDelete(null);
    };

    useEffect(() => {
        if (jcrData?.jcr?.nodeByPath?.children?.nodes) {
            const loadedStyles = jcrData.jcr.nodeByPath.children.nodes.map(node => {
                const props = {};
                node.properties?.forEach(prop => {
                    props[prop.name] = prop.value;
                });
                return {
                    uuid: node.uuid,
                    name: props['eximg:name'] || node.displayName || node.name,
                    exactlyId: props['eximg:exactlyId'],
                    status: props['eximg:status'] || 'unknown',
                    active: props['eximg:active'] === 'true' || props['eximg:active'] === true,
                    lastSynced: props['eximg:lastSynced']
                };
            });
            setStyles(loadedStyles);
            
            // Check training progress for styles with 'training' status (only once on page load)
            loadedStyles.forEach(style => {
                if (style.status === 'training') {
                    getProgress({
                        variables: {
                            styleUuid: style.uuid
                        }
                    }).then(result => {
                        if (result?.data?.exactly?.getTrainingProgress?.successful) {
                            try {
                                const progress = JSON.parse(result.data.exactly.getTrainingProgress.message);
                                setTrainingProgress(prev => ({
                                    ...prev,
                                    [style.uuid]: {
                                        status: progress.status,
                                        progress: progress.progress
                                    }
                                }));
                            } catch (e) {
                                console.error('Failed to parse training progress:', e);
                            }
                        }
                    }).catch(error => {
                        console.error('Error fetching training progress:', error);
                    });
                }
            });
        }
    }, [jcrData]);

    const handleStyleClick = style => {
        onStyleSelect(style.uuid, style.name, style.status);
    };

    return (
        <div className="style-step">
            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
            >
                <DialogTitle>{t('actions.delete')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {styleToDelete && t('style.confirmDelete', {name: styleToDelete.name})}
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
                        onClick={confirmDelete}
                    />
                </DialogActions>
            </Dialog>

            <div className="style-step__header">
                <Typography variant="title">{t('style.title')}</Typography>
                <Typography variant="body">{t('style.description')}</Typography>
            </div>

            <div className="style-step__actions">
                <Button
                    icon={<Reload/>}
                    label={syncing ? t('style.syncing') : t('style.syncButton')}
                    disabled={syncing}
                    onClick={handleSync}
                />
                <Button
                    label={t('style.createButton')}
                    color="accent"
                    variant="outlined"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    disabled={creating}
                />
            </div>

            {showCreateForm && (
                <div className="style-step__create-form">
                    <Typography variant="subheading">{t('style.createNewStyle')}</Typography>
                    <Input
                        placeholder={t('style.namePlaceholder')}
                        value={newStyleName}
                        onChange={e => setNewStyleName(e.target.value)}
                        disabled={creating}
                    />
                    <Input
                        placeholder={t('style.descriptionPlaceholder')}
                        value={newStyleDescription}
                        onChange={e => setNewStyleDescription(e.target.value)}
                        disabled={creating}
                    />
                    <div className="style-step__create-actions">
                        <Button
                            label={t('actions.create')}
                            color="accent"
                            onClick={handleCreate}
                            disabled={creating || !newStyleName.trim()}
                        />
                        <Button
                            label={t('actions.cancel')}
                            variant="outlined"
                            onClick={() => {
                                setShowCreateForm(false);
                                setNewStyleName('');
                                setNewStyleDescription('');
                            }}
                            disabled={creating}
                        />
                    </div>
                </div>
            )}

            {jcrLoading ? (
                <div className="style-step__loading">
                    <Loader/>
                    <Typography variant="body">{t('style.loading')}</Typography>
                </div>
            ) : (
                <div className="style-step__list">
                    {styles.length === 0 ? (
                        <div className="style-step__empty">
                            <Typography variant="body">{t('style.noStyles')}</Typography>
                            <Typography variant="caption">{t('style.syncFirst')}</Typography>
                        </div>
                    ) : (
                        styles.map(style => (
                            <div
                                key={style.uuid}
                                className={`style-card ${selectedStyleUuid === style.uuid ? 'style-card--selected' : ''}`}
                            >
                                <div 
                                    className="style-card__clickable"
                                    onClick={() => handleStyleClick(style)}
                                >
                                    <div className="style-card__content">
                                        <Typography variant="subheading" className="style-card__name">
                                            {style.name}
                                            {style.active && <span className="style-card__active-badge"> ✓ Active</span>}
                                        </Typography>
                                        <Typography variant="caption" className="style-card__id">
                                            ID: {style.exactlyId || style.uuid}
                                        </Typography>
                                    </div>
                                    <div className="style-card__meta">
                                        <StatusBadge status={style.status}/>
                                        {trainingProgress[style.uuid] && (
                                            <Typography variant="caption" className="style-card__progress">
                                                {t('style.trainingProgress')}: {trainingProgress[style.uuid].progress}%
                                            </Typography>
                                        )}
                                        {style.lastSynced && (
                                            <Typography variant="caption" className="style-card__synced">
                                                {t('style.lastSynced')}: {new Date(style.lastSynced).toLocaleString()}
                                            </Typography>
                                        )}
                                    </div>
                                </div>
                                <div className="style-card__actions">
                                    <Button
                                        icon={<Delete/>}
                                        variant="ghost"
                                        color="danger"
                                        size="default"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(style.uuid, style.name);
                                        }}
                                        disabled={deleting}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default StyleStep;
