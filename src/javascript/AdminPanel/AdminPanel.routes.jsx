import {registry} from '@jahia/ui-extender';
import constants from './AdminPanel.constants';
import {AdminPanel} from './AdminPanel';
import React, {Suspense} from 'react';
import DefaultEntry from '@jahia/moonstone/dist/icons/components/DefaultEntry';

export const registerRoutes = () => {
    registry.add('adminRoute', 'exactlyImageGenerator', {
        targets: ['jcontent:95'],
        icon: <DefaultEntry/>,
        label: 'exactlyImageGenerator:label',
        path: `${constants.DEFAULT_ROUTE}*`, // Catch everything and let the app handle routing logic
        defaultPath: constants.DEFAULT_ROUTE,
        isSelectable: true,
        render: v => <Suspense fallback="loading ..."><AdminPanel match={v.match}/></Suspense>
    });

    console.debug('%c exactlyImageGenerator is activated', 'color: #3c8cba');
};
