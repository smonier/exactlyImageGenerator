/**
 * Status Badge Component
 * Displays style/project status with appropriate color
 */

import React from 'react';
import './StatusBadge.css';

const STATUS_COLORS = {
    active: 'success',
    ready: 'success',
    training: 'warning',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
    pending: 'default',
    draft: 'default',
    unknown: 'default'
};

const StatusBadge = ({status}) => {
    const color = STATUS_COLORS[status?.toLowerCase()] || 'default';
    return (
        <span className={`status-badge status-badge--${color}`}>
            {status}
        </span>
    );
};

export default StatusBadge;
