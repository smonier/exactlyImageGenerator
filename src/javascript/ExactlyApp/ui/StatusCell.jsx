import React, {useEffect, useRef} from 'react';
import {useQuery} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import {Loader, Typography} from '@jahia/moonstone';
import {NS, POLL_INTERVAL_MS, STATUS} from '../constants';
import {TRAINING_PROGRESS} from '../graphql';
import {StatusChip} from './StatusChip';
import classes from './layout.module.css';

const parseProgress = answer => {
    try {
        return answer?.successful ? JSON.parse(answer.message) : null;
    } catch {
        return null;
    }
};

/**
 * Status of a style in the styles table. A style in training polls its progress and shows it next to
 * the chip; once Exactly reports the training over, onFinished runs once (the table then resyncs).
 */
export const StatusCell = ({styleUuid, status, onFinished}) => {
    const {t} = useTranslation(NS);
    const isTraining = status === STATUS.TRAINING;
    const finished = useRef(false);
    const {data} = useQuery(TRAINING_PROGRESS, {
        variables: {styleUuid},
        skip: !isTraining,
        pollInterval: isTraining ? POLL_INTERVAL_MS : 0,
        fetchPolicy: 'network-only'
    });
    const progress = isTraining ? parseProgress(data?.exactly?.trainingProgress) : null;
    const isOver = Boolean(progress) && (progress.status === STATUS.READY || progress.status === STATUS.FAILED || progress.progress >= 100);

    useEffect(() => {
        if (isOver && !finished.current) {
            finished.current = true;
            onFinished();
        }
    }, [isOver, onFinished]);

    if (!isTraining) {
        return <StatusChip status={status}/>;
    }
    return (
        <div className={classes.statusCell}>
            <StatusChip status={isOver ? progress.status : STATUS.TRAINING}/>
            {!isOver && (
                <div className={classes.row}>
                    <Loader size="small"/>
                    <Typography variant="caption">
                        {progress ? t('styles.progress', {progress: progress.progress ?? 0}) : t('styles.progressPending')}
                    </Typography>
                </div>
            )}
        </div>
    );
};
