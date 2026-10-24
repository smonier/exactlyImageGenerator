import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useMutation, useQuery} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import {
    AddCircle,
    Button,
    DataTable,
    Delete,
    EmptyData,
    Field,
    Input,
    Loader,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PhotoLibrary,
    Reload,
    Textarea,
    Typography
} from '@jahia/moonstone';
import {NS, STATUS} from '../constants';
import {CREATE_STYLE, DELETE_STYLE, STYLES, SYNC_STYLES, errorMessage, readAnswer} from '../graphql';
import {Section} from '../ui/Section';
import {StatusCell} from '../ui/StatusCell';
import {ConfirmModal} from '../ui/ConfirmModal';
import classes from '../ui/layout.module.css';

const toStyle = node => ({
    uuid: node.uuid,
    name: node.styleName?.value || node.name,
    exactlyId: node.exactlyId?.value,
    status: node.status?.value || STATUS.UNKNOWN,
    description: node.description?.value || '',
    lastSynced: node.lastSynced?.value
});

/** Step 1: the styles (Exactly models) of the site; pick one to train or generate with. */
const StylesTab = ({siteKey, uilang, style, canCallExactly, onSelect, onOpenTraining, onError, notify}) => {
    const {t} = useTranslation(NS);
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [toDelete, setToDelete] = useState(null);
    const autoSynced = useRef(false);

    const path = `/sites/${siteKey}/contents/exactly-styles`;
    // The folder only exists after the first sync: a missing path is an empty list, not an error.
    const {data, loading, refetch} = useQuery(STYLES, {
        variables: {path},
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
    });
    const styles = useMemo(
        () => (data?.jcr?.nodeByPath?.children?.nodes || []).map(toStyle),
        [data]
    );

    const [syncStyles, {loading: syncing}] = useMutation(SYNC_STYLES);
    const [createStyle, {loading: creating}] = useMutation(CREATE_STYLE);
    const [deleteStyle, {loading: deleting}] = useMutation(DELETE_STYLE);

    const sync = async ({quiet = false} = {}) => {
        try {
            const result = await syncStyles({variables: {siteKey}});
            readAnswer(result.data?.exactly?.syncStyles);
            await refetch();
            if (!quiet) {
                notify('info', t('styles.synced'));
            }
        } catch (e) {
            onError(t('styles.syncFailed', {message: errorMessage(e)}));
        }
    };

    // Refresh the statuses from Exactly once when the step opens
    useEffect(() => {
        if (canCallExactly && !autoSynced.current) {
            autoSynced.current = true;
            sync({quiet: true});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canCallExactly]);

    // A training that ends while the list is open: resync so the row shows the status Exactly now holds
    const syncRef = useRef(sync);
    syncRef.current = sync;
    const onTrainingFinished = useCallback(() => syncRef.current({quiet: true}), []);

    const closeCreate = () => {
        setCreateOpen(false);
        setNewName('');
        setNewDescription('');
    };

    const create = async () => {
        try {
            const result = await createStyle({variables: {siteKey, name: newName.trim(), description: newDescription.trim() || null}});
            readAnswer(result.data?.exactly?.createStyle);
            closeCreate();
            await refetch();
            notify('info', t('styles.created', {name: newName.trim()}));
        } catch (e) {
            onError(t('styles.createFailed', {message: errorMessage(e)}));
        }
    };

    const remove = async () => {
        const target = toDelete;
        setToDelete(null);
        try {
            const result = await deleteStyle({variables: {styleUuid: target.uuid}});
            readAnswer(result.data?.exactly?.deleteStyle);
            await refetch();
            notify('info', t('styles.deleted', {name: target.name}));
        } catch (e) {
            onError(t('styles.deleteFailed', {message: errorMessage(e)}));
        }
    };

    const formatDate = value => (value ? new Date(value).toLocaleString(uilang || undefined) : '-');

    const columns = [
        {
            key: 'name',
            label: t('styles.columns.name'),
            width: '32%',
            render: ({data: row}) => (
                <div className={classes.cellText}>
                    <Typography weight="semiBold">{row.name}</Typography>
                    {row.description && <Typography variant="caption">{row.description}</Typography>}
                </div>
            )
        },
        {
            key: 'status',
            label: t('styles.columns.status'),
            width: '15%',
            render: ({value, data: row}) => <StatusCell styleUuid={row.uuid} status={value} onFinished={onTrainingFinished}/>
        },
        {
            key: 'lastSynced',
            label: t('styles.columns.lastSynced'),
            width: '20%',
            render: ({value}) => <Typography variant="caption">{formatDate(value)}</Typography>
        },
        {
            key: 'uuid',
            label: t('styles.columns.actions'),
            width: '33%',
            align: 'right',
            render: ({data: row}) => (
                <div className={classes.cellActions}>
                    <Button
                        icon={<PhotoLibrary/>}
                        variant="ghost"
                        label={t('styles.viewTraining')}
                        aria-label={t('styles.viewTrainingOf', {name: row.name})}
                        onClick={e => {
                            e.stopPropagation();
                            onOpenTraining(row);
                        }}
                    />
                    <Button
                        label={style?.uuid === row.uuid ? t('styles.selected') : t('styles.select')}
                        color="accent"
                        variant={style?.uuid === row.uuid ? 'default' : 'outlined'}
                        onClick={e => {
                            e.stopPropagation();
                            onSelect(row);
                        }}
                    />
                    <Button
                        variant="ghost"
                        color="danger"
                        icon={<Delete/>}
                        aria-label={t('styles.delete', {name: row.name})}
                        isDisabled={deleting || !canCallExactly}
                        onClick={e => {
                            e.stopPropagation();
                            setToDelete(row);
                        }}
                    />
                </div>
            )
        }
    ];

    return (
        <>
            <Section
                title={t('styles.title')}
                description={t('styles.description')}
                actions={[
                    <Button key="sync"
                            icon={<Reload/>}
                            label={t('styles.sync')}
                            variant="outlined"
                            isLoading={syncing}
                            isDisabled={syncing || !canCallExactly}
                            onClick={() => sync()}/>,
                    <Button key="create"
                            icon={<AddCircle/>}
                            label={t('styles.create')}
                            color="accent"
                            isDisabled={!canCallExactly}
                            onClick={() => setCreateOpen(true)}/>
                ]}
            >
                {loading && styles.length === 0 && <div className={classes.center}><Loader size="big"/></div>}
                {!loading && styles.length === 0 && (
                    <EmptyData title={t('styles.emptyTitle')} message={t('styles.empty')}/>
                )}
                {styles.length > 0 && (
                    <div className={classes.tableScroll}>
                        <DataTable
                            primaryKey="uuid"
                            data={styles}
                            columns={columns}
                            enablePagination={false}
                            rowProps={({data: row}) => ({
                                className: style?.uuid === row.uuid ? classes.selectedRow : classes.clickableRow,
                                onClick: () => onSelect(row)
                            })}
                        />
                    </div>
                )}
            </Section>

            <Modal isOpen={createOpen} size="medium" onOpenChange={open => !open && closeCreate()}>
                <>
                    <ModalHeader title={t('styles.createTitle')}/>
                    <ModalBody>
                        <div className={classes.stack}>
                            <Field id="exactly-style-name" label={t('styles.name')} helper={t('styles.nameHelper')}>
                                <Input id="exactly-style-name"
                                       value={newName}
                                       maxLength={200}
                                       placeholder={t('styles.namePlaceholder')}
                                       onChange={e => setNewName(e.target.value)}/>
                            </Field>
                            <Field id="exactly-style-description" label={t('styles.descriptionLabel')}>
                                <Textarea id="exactly-style-description"
                                          value={newDescription}
                                          rows={3}
                                          placeholder={t('styles.descriptionPlaceholder')}
                                          onChange={e => setNewDescription(e.target.value)}/>
                            </Field>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" label={t('actions.cancel')} onClick={closeCreate}/>
                        <Button color="accent"
                                label={t('actions.create')}
                                isLoading={creating}
                                isDisabled={creating || newName.trim() === ''}
                                onClick={create}/>
                    </ModalFooter>
                </>
            </Modal>

            <ConfirmModal
                isOpen={Boolean(toDelete)}
                title={t('styles.deleteTitle')}
                message={toDelete ? t('styles.confirmDelete', {name: toDelete.name}) : ''}
                confirmLabel={t('actions.delete')}
                onConfirm={remove}
                onClose={() => setToDelete(null)}
            />
        </>
    );
};

export default StylesTab;
