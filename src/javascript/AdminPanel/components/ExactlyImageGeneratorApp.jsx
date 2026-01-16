/**
 * Exactly.ai Image Generator - Main App Component
 *
 * Production-ready wizard with:
 * - Step 1: Sync & Select Style
 * - Step 2: Train with DAM Assets
 * - Step 3: Generate & Preview Images
 * - Step 4: Save to DAM
 */

import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Typography, Button} from '@jahia/moonstone';
import {Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from '@material-ui/core';
import {createApolloClient} from '../../graphql/apolloClient';
import StyleStep from './StyleStep';
import TrainStep from './TrainStep';
import GenerateStep from './GenerateStep';
import WizardNavigation from './WizardNavigation';
import ErrorBanner from './ErrorBanner';
import './ExactlyImageGeneratorApp.css';

const apolloClient = createApolloClient();

const STEPS = {
    STYLE: 0,
    TRAIN: 1,
    GENERATE: 2
};

const ExactlyImageGeneratorApp = ({renderHeader}) => {
    const {
        t,
        i18n: {language: uiLanguage}
    } = useTranslation('exactlyImageGenerator');

    // Wizard state
    const [currentStep, setCurrentStep] = useState(STEPS.STYLE);
    const [globalError, setGlobalError] = useState(null);
    const [showResetDialog, setShowResetDialog] = useState(false);

    // Shared state across steps
    const [selectedStyleUuid, setSelectedStyleUuid] = useState(null);
    const [selectedStyleName, setSelectedStyleName] = useState('');
    const [selectedStyleStatus, setSelectedStyleStatus] = useState('unknown');
    const [selectedStyleDescription, setSelectedStyleDescription] = useState('');
    const [generatedUrls, setGeneratedUrls] = useState([]);

    // Navigation handlers
    const canProgress = () => {
        switch (currentStep) {
            case STEPS.STYLE:
                return selectedStyleUuid !== null;
            case STEPS.TRAIN:
                // Can only progress to Generate if model is not currently training
                return selectedStyleStatus !== 'training';
            case STEPS.GENERATE:
                return false; // Final step
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (canProgress()) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.GENERATE));
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(prev - 1, STEPS.STYLE));
    };

    const handleReset = () => {
        setShowResetDialog(true);
    };

    const confirmReset = () => {
        setCurrentStep(STEPS.STYLE);
        setSelectedStyleUuid(null);
        setSelectedStyleName('');
        setSelectedStyleStatus('unknown');
        setSelectedStyleDescription('');
        setGeneratedUrls([]);
        setGlobalError(null);
        setShowResetDialog(false);
    };

    // Render header with current state
    React.useEffect(() => {
        if (renderHeader) {
            renderHeader({
                currentStep,
                canProgress: canProgress(),
                handleBack,
                handleNext,
                handleReset,
                isLastStep: currentStep >= STEPS.GENERATE,
                t
            });
        }
    }, [currentStep, selectedStyleUuid, renderHeader]);

    return (
            <div className="exactly-app">
                {/* Confirmation Dialogs */}
                <Dialog
                    open={showResetDialog}
                    onClose={() => setShowResetDialog(false)}
                >
                    <DialogTitle>{t('actions.reset')}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>{t('app.confirmReset')}</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            label={t('actions.cancel')}
                            variant="ghost"
                            onClick={() => setShowResetDialog(false)}
                        />
                        <Button
                            label={t('actions.reset')}
                            color="danger"
                            onClick={confirmReset}
                        />
                    </DialogActions>
                </Dialog>

                <div className="exactly-app__body">
                    {/* Global Error Banner */}
                    {globalError && (
                        <ErrorBanner
                            message={globalError}
                            onDismiss={() => setGlobalError(null)}
                        />
                    )}

                    {/* Wizard Navigation */}
                    <WizardNavigation
                        currentStep={currentStep}
                        steps={[
                            {id: STEPS.STYLE, label: t('steps.style')},
                            {id: STEPS.TRAIN, label: t('steps.train')},
                            {id: STEPS.GENERATE, label: t('steps.generate')}
                        ]}
                        onStepClick={step => {
                            // Allow navigation to any accessible step
                            // Can go back to any previous step
                            if (step <= currentStep) {
                                setCurrentStep(step);
                                return;
                            }
                            
                            // Forward navigation logic
                            // If on Style step and model is ready, allow jumping directly to Generate
                            if (currentStep === STEPS.STYLE && step === STEPS.GENERATE && selectedStyleStatus === 'ready') {
                                setCurrentStep(step);
                                return;
                            }
                            
                            // Otherwise, can only move to next step if canProgress allows it
                            if (step === currentStep + 1 && canProgress()) {
                                setCurrentStep(step);
                            }
                        }}
                        canProgress={canProgress()}
                        selectedStyleStatus={selectedStyleStatus}
                    />

                    {/* Step Content */}
                    <div className="exactly-app__content">
                    {currentStep === STEPS.STYLE && (
                        <StyleStep
                            selectedStyleUuid={selectedStyleUuid}
                            selectedStyleName={selectedStyleName}
                            onStyleSelect={(uuid, name, status, description) => {
                                setSelectedStyleUuid(uuid);
                                setSelectedStyleName(name);
                                setSelectedStyleStatus(status || 'unknown');
                                setSelectedStyleDescription(description || '');
                            }}
                            onError={setGlobalError}
                        />
                    )}

                    {currentStep === STEPS.TRAIN && (
                        <TrainStep
                            styleUuid={selectedStyleUuid}
                            styleName={selectedStyleName}
                            styleStatus={selectedStyleStatus}
                            styleDescription={selectedStyleDescription}
                            onTrainComplete={() => {/* Training complete */}}
                            onError={setGlobalError}
                        />
                    )}

                    {currentStep === STEPS.GENERATE && (
                        <GenerateStep
                            styleUuid={selectedStyleUuid}
                            styleName={selectedStyleName}
                            styleDescription={selectedStyleDescription}
                            generatedUrls={generatedUrls}
                            onGenerationComplete={(_projectUuid, urls) => {
                                setGeneratedUrls(urls);
                            }}
                            onError={setGlobalError}
                        />
                    )}
                </div>
                </div>
            </div>
    );
};

export default ExactlyImageGeneratorApp;
