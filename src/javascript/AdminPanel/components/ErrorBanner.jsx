/**
 * Error Banner Component
 * Displays error messages with dismiss action
 */

import React from 'react';
import {Typography, Button} from '@jahia/moonstone';
import './ErrorBanner.css';

const ErrorBanner = ({message, onDismiss}) => {
    return (
        <div className="error-banner">
            <div className="error-banner__content">
                <span className="error-banner__icon">⚠️</span>
                <Typography variant="body" className="error-banner__message">
                    {message}
                </Typography>
            </div>
            <Button
                label="×"
                variant="ghost"
                className="error-banner__close"
                onClick={onDismiss}
            />
        </div>
    );
};

export default ErrorBanner;
