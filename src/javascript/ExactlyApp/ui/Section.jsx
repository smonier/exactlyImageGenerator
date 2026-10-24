import React from 'react';
import {Paper, Typography} from '@jahia/moonstone';
import classes from './layout.module.css';

/** A titled card: Moonstone Paper with a heading, an optional description and actions on the right. */
export const Section = ({title, description, actions, children}) => (
    <Paper hasPadding>
        <div className={classes.sectionHead}>
            <div className={classes.sectionTitle}>
                <Typography variant="heading" weight="bold">{title}</Typography>
                {description && <Typography variant="caption">{description}</Typography>}
            </div>
            {actions && <div className={classes.actions}>{actions}</div>}
        </div>
        {children && <div className={classes.sectionBody}>{children}</div>}
    </Paper>
);
