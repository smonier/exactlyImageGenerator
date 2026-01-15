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
                    title={`${t('app.title')} - ${getSiteKey()}`}
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

