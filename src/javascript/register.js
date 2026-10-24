import i18next from 'i18next';
import {registerRoutes} from './ExactlyApp/ExactlyApp.routes';
import {NS} from './ExactlyApp/constants';

export default async function () {
    await i18next.loadNamespaces(NS);
    registerRoutes();
}
