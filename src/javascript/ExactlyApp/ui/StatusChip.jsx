import React from 'react';
import {useTranslation} from 'react-i18next';
import {Chip} from '@jahia/moonstone';
import {NS} from '../constants';

const COLORS = {
    ready: 'success',
    active: 'success',
    training: 'accent',
    processing: 'accent',
    draft: 'default',
    failed: 'danger',
    canceled: 'warning'
};

/** Exactly model status as a Moonstone Chip. */
export const StatusChip = ({status}) => {
    const {t} = useTranslation(NS);
    const value = status || 'unknown';
    return <Chip color={COLORS[value] || 'default'} label={t(`status.${value}`, {defaultValue: value})}/>;
};
