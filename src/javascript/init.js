import {registry} from '@jahia/ui-extender';

// Exposed as './init' by Module Federation: registers the start-up callback, which loads the rest.
export default function () {
    registry.add('callback', 'exactlyImageGenerator', {
        targets: ['jahiaApp-init:50'],
        callback: async () => {
            const {default: register} = await import('./register');
            await register();
        }
    });
}
