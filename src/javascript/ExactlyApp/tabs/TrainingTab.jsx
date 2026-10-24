import React, {useEffect, useState} from 'react';
import {useMutation, useQuery} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import {
    Button,
    Check,
    Close,
    CloudUpload,
    Delete,
    EditImage,
    EmptyData,
    Loader,
    PhotoLibrary,
    Typography
} from '@jahia/moonstone';
import {MIN_TRAINING_IMAGES, NS, POLL_INTERVAL_MS, STATUS} from '../constants';
import {
    CANCEL_TRAINING,
    DELETE_TRAINING_IMAGE,
    MODEL,
    PUT_MODEL_TO_DRAFT,
    TRAINING_IMAGES,
    TRAINING_PROGRESS,
    TRAIN_STYLE,
    UPLOAD_TRAINING_IMAGES,
    errorMessage,
    readAnswer
} from '../graphql';
import {canOpenPicker, fileUrl, isHttpsUrl, openPicker} from '../media';
import {Section} from '../ui/Section';
import {StatusChip} from '../ui/StatusChip';
import {ConfirmModal} from '../ui/ConfirmModal';
import classes from '../ui/layout.module.css';

const parse = (answer, fallback) => {
    try {
        return answer?.successful ? JSON.parse(answer.message) : fallback;
    } catch {
        return fallback;
    }
};

/** Step 2: the training images of the style on Exactly, new images from the media library, training. */
const TrainingTab = ({siteKey, language, uilang, style, onError, notify, onStatusChange, onGoToGenerate}) => {
    const {t} = useTranslation(NS);
    const styleUuid = style.uuid;
    const [selected, setSelected] = useState([]);
    const [toDelete, setToDelete] = useState(null);

    const {data: modelData} = useQuery(MODEL, {variables: {styleUuid}, fetchPolicy: 'network-only'});
    const modelStatus = parse(modelData?.exactly?.model, null)?.status;
    const status = style.status;
    const isTraining = status === STATUS.TRAINING;
    const isDraft = !isTraining && status !== STATUS.READY;

    // Exactly is the reference for the status: align the app on it once it answers
    useEffect(() => {
        if (modelStatus && modelStatus !== status) {
            onStatusChange(modelStatus);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelStatus]);

    const {data: progressData} = useQuery(TRAINING_PROGRESS, {
        variables: {styleUuid},
        skip: !isTraining,
        pollInterval: isTraining ? POLL_INTERVAL_MS : 0,
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: false
    });
    const progress = parse(progressData?.exactly?.trainingProgress, null);

    useEffect(() => {
        if (!progress) {
            return;
        }
        if (progress.status === STATUS.READY || progress.progress >= 100) {
            onStatusChange(STATUS.READY);
            notify('info', t('training.done'));
        } else if (progress.status === STATUS.FAILED) {
            onStatusChange(STATUS.FAILED);
            onError(t('training.failed'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progress?.status, progress?.progress]);

    const {data: imagesData, loading: loadingImages, refetch: refetchImages} = useQuery(TRAINING_IMAGES, {
        variables: {styleUuid},
        fetchPolicy: 'network-only'
    });
    const trainingImages = parse(imagesData?.exactly?.trainingImages, []).filter(image => isHttpsUrl(image.url));

    const [upload, {loading: uploading}] = useMutation(UPLOAD_TRAINING_IMAGES);
    const [deleteImage] = useMutation(DELETE_TRAINING_IMAGE);
    const [train, {loading: starting}] = useMutation(TRAIN_STYLE);
    const [toDraft, {loading: drafting}] = useMutation(PUT_MODEL_TO_DRAFT);
    const [cancel, {loading: canceling}] = useMutation(CANCEL_TRAINING);

    const pickImages = () => {
        if (!canOpenPicker()) {
            onError(t('errors.noPicker'));
            return;
        }
        openPicker({
            type: 'image',
            site: siteKey,
            lang: language,
            uilang,
            isMultiple: true,
            onSelect: items => setSelected(current => [
                ...current,
                ...items.filter(item => item.uuid && !current.some(c => c.uuid === item.uuid))
            ])
        });
    };

    const uploadSelected = async () => {
        try {
            const result = await upload({variables: {styleUuid, damAssetUuids: selected.map(s => s.uuid)}});
            const message = readAnswer(result.data?.exactly?.uploadTrainingImages);
            setSelected([]);
            await refetchImages();
            notify('info', message);
        } catch (e) {
            onError(t('training.uploadFailed', {message: errorMessage(e)}));
        }
    };

    const removeImage = async () => {
        const image = toDelete;
        setToDelete(null);
        try {
            const result = await deleteImage({variables: {styleUuid, imageUid: image.id}});
            readAnswer(result.data?.exactly?.deleteTrainingImage);
            await refetchImages();
        } catch (e) {
            onError(t('training.deleteFailed', {message: errorMessage(e)}));
        }
    };

    const command = async (mutation, field, nextStatus, failureKey) => {
        try {
            const result = await mutation({variables: {styleUuid}});
            readAnswer(result.data?.exactly?.[field]);
            onStatusChange(nextStatus);
            await refetchImages();
        } catch (e) {
            onError(t(failureKey, {message: errorMessage(e)}));
        }
    };

    const notEnoughImages = trainingImages.length < MIN_TRAINING_IMAGES;

    return (
        <>
            <Section
                title={style.name}
                description={style.description || t('training.description')}
                actions={[
                    <StatusChip key="status" status={status}/>,
                    isDraft && (
                        <Button key="train"
                                icon={<Check/>}
                                color="accent"
                                label={t('training.start')}
                                isLoading={starting}
                                isDisabled={starting || trainingImages.length === 0}
                                onClick={() => command(train, 'trainStyle', STATUS.TRAINING, 'training.startFailed')}/>
                    ),
                    isTraining && (
                        <Button key="cancel"
                                icon={<Close/>}
                                color="danger"
                                variant="outlined"
                                label={t('training.cancel')}
                                isLoading={canceling}
                                isDisabled={canceling}
                                onClick={() => command(cancel, 'cancelTraining', STATUS.DRAFT, 'training.cancelFailed')}/>
                    ),
                    status === STATUS.READY && (
                        <Button key="draft"
                                icon={<EditImage/>}
                                variant="outlined"
                                label={t('training.toDraft')}
                                isLoading={drafting}
                                isDisabled={drafting}
                                onClick={() => command(toDraft, 'putModelToDraft', STATUS.DRAFT, 'training.draftFailed')}/>
                    ),
                    status === STATUS.READY && (
                        <Button key="generate"
                                color="accent"
                                label={t('training.goToGenerate')}
                                onClick={onGoToGenerate}/>
                    )
                ].filter(Boolean)}
            >
                {isTraining && (
                    <div className={classes.row}>
                        <Loader size="small"/>
                        <Typography>
                            {progress?.progress > 0
                                ? t('training.progress', {progress: progress.progress})
                                : t('training.inProgress')}
                        </Typography>
                    </div>
                )}
                {isDraft && notEnoughImages && (
                    <Typography variant="caption">{t('training.minImages', {count: MIN_TRAINING_IMAGES})}</Typography>
                )}
            </Section>

            <Section
                title={t('training.imagesTitle', {count: trainingImages.length})}
                description={t('training.imagesDescription')}
            >
                {loadingImages && trainingImages.length === 0 && <div className={classes.center}><Loader/></div>}
                {!loadingImages && trainingImages.length === 0 && (
                    <EmptyData title={t('training.noImagesTitle')} message={t('training.noImages')}/>
                )}
                {trainingImages.length > 0 && (
                    <ul className={classes.imageGrid}>
                        {trainingImages.map((image, index) => (
                            <li key={image.id || index} className={classes.tile}>
                                {/* Exactly serves these images; they are only previews */}
                                <img className={classes.tileImage} src={image.url} alt={t('training.imageAlt', {index: index + 1})} loading="lazy"/>
                                {isDraft && (
                                    <div className={classes.tileBar}>
                                        <Button variant="ghost"
                                                color="danger"
                                                size="small"
                                                icon={<Delete/>}
                                                aria-label={t('training.deleteImage', {index: index + 1})}
                                                onClick={() => setToDelete(image)}/>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {isDraft && (
                <Section
                    title={t('training.addTitle')}
                    description={t('training.addDescription')}
                    actions={[
                        <Button key="pick"
                                icon={<PhotoLibrary/>}
                                variant="outlined"
                                label={t('training.pick')}
                                isDisabled={uploading}
                                onClick={pickImages}/>,
                        <Button key="upload"
                                icon={<CloudUpload/>}
                                color="accent"
                                label={t('training.upload', {count: selected.length})}
                                isLoading={uploading}
                                isDisabled={uploading || selected.length === 0}
                                onClick={uploadSelected}/>
                    ]}
                >
                    {selected.length > 0 && (
                        <ul className={classes.imageGrid}>
                            {selected.map(asset => (
                                <li key={asset.uuid} className={classes.tile}>
                                    <img className={classes.tileImage} src={fileUrl(asset.path, {thumbnail: true})} alt={asset.name || ''}/>
                                    <div className={classes.tileBar}>
                                        <Typography variant="caption" className={classes.tileName}>{asset.name}</Typography>
                                        <Button variant="ghost"
                                                size="small"
                                                icon={<Close/>}
                                                aria-label={t('training.unselect', {name: asset.name})}
                                                isDisabled={uploading}
                                                onClick={() => setSelected(s => s.filter(a => a.uuid !== asset.uuid))}/>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            )}

            <ConfirmModal
                isOpen={Boolean(toDelete)}
                title={t('training.deleteTitle')}
                message={t('training.confirmDelete')}
                confirmLabel={t('actions.delete')}
                onConfirm={removeImage}
                onClose={() => setToDelete(null)}
            />
        </>
    );
};

export default TrainingTab;
