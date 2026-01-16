/**
 * Exactly.ai Image Generator - Main Admin Panel Component
 *
 * This is the entry point that Jahia loads when accessing the admin route.
 * It wraps the main app component with Apollo Provider and Moonstone LayoutContent.
 */

import React, {useState} from 'react';
import {LayoutContent, Header, Button} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';
import {ApolloProvider} from '@apollo/client';
import {createApolloClient} from '../graphql/apolloClient';
import ExactlyImageGeneratorApp from './components/ExactlyImageGeneratorApp';
import './AdminPanel.css';

const apolloClient = createApolloClient();

export const AdminPanel = () => {
    const {
        t,
        i18n: {language: uiLanguage}
    } = useTranslation('exactlyImageGenerator');
    const [headerState, setHeaderState] = useState(null);

    const getSiteKey = () => {
        return window.contextJsParameters?.site || 'systemsite';
    };

    return (
        <LayoutContent
            withPadding={false}
            header={headerState && (
                <Header
                    title={(
                        <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 20 20">
                                <path fill="rgb(251, 65, 31)" d="M1 8.725c0-.21 0-.316.04-.395a.37.37 0 0 1 .162-.164c.08-.041.185-.043.397-.045 2.315-.03 4.944-.16 6.942 1.096a7.1 7.1 0 0 1 2.242 2.242c1.256 1.999 1.125 4.628 1.097 6.941-.004.213-.005.319-.046.398a.37.37 0 0 1-.164.162c-.08.04-.184.04-.395.04h-2.55c-.21 0-.315 0-.395-.041a.4.4 0 0 1-.164-.165c-.041-.081-.04-.186-.038-.394.01-1.243.034-2.503-.143-3.732l-2.534 2.534c-.148.148-.222.222-.308.25a.37.37 0 0 1-.232 0c-.085-.028-.16-.102-.308-.25l-1.804-1.804c-.148-.148-.223-.222-.25-.308a.37.37 0 0 1 0-.232c.027-.085.102-.16.25-.308l2.535-2.535c-1.229-.177-2.49-.153-3.734-.142-.209 0-.313.001-.393-.04a.4.4 0 0 1-.166-.163C1 11.59 1 11.484 1 11.275zM11.275 1c.21 0 .315 0 .395.041a.4.4 0 0 1 .164.165c.04.081.04.186.038.394-.01 1.244-.034 2.504.143 3.732l2.534-2.533c.148-.149.223-.223.308-.251a.37.37 0 0 1 .232 0c.085.028.16.102.308.25L17.2 4.602c.149.149.223.223.251.309a.4.4 0 0 1 0 .232c-.027.085-.102.16-.25.308l-2.535 2.535c1.229.177 2.49.153 3.734.142.209 0 .313-.002.393.04a.4.4 0 0 1 .166.163c.041.08.041.186.041.395v2.55c0 .21 0 .316-.04.395a.37.37 0 0 1-.162.164c-.08.041-.185.043-.397.045-2.315.03-4.943.16-6.941-1.096a7.1 7.1 0 0 1-2.243-2.242c-1.256-2-1.125-4.63-1.097-6.942.004-.213.005-.319.046-.398a.37.37 0 0 1 .164-.161C8.41 1 8.514 1 8.725 1z"></path>
                            </svg>
                            <span>{`${t('app.title')} - ${getSiteKey()}`}</span>
                        </span>
                    )}
                    mainActions={[
                        <Button
                            key="backButton"
                            size="big"
                            label={t('actions.back')}
                            variant="outlined"
                            isDisabled={headerState.currentStep === 0}
                            onClick={headerState.handleBack}
                        />,
                        !headerState.isLastStep && (
                            <Button
                                key="nextButton"
                                size="big"
                                label={t('actions.next')}
                                color="accent"
                                isDisabled={!headerState.canProgress}
                                onClick={headerState.handleNext}
                            />
                        ),
                        <Button
                            key="resetButton"
                            size="big"
                            label={t('actions.reset')}
                            color="danger"
                            onClick={headerState.handleReset}
                        />
                    ].filter(Boolean)}
                />
            )}
            content={(
                <ApolloProvider client={apolloClient}>
                    <div className="exactly-admin-panel">
                        <ExactlyImageGeneratorApp renderHeader={setHeaderState}/>
                    </div>
                </ApolloProvider>
            )}
        />
    );
};

