/**
 * Exactly.ai Image Generator - Main App Component
 *
 * Production-ready wizard with:
 * - Step 1: Sync & Select Style
 * - Step 2: Train with DAM Assets
 * - Step 3: Generate & Preview Images
 * - Step 4: Save to DAM
 */

import React, {useState, useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Typography, Button} from '@jahia/moonstone';
import {Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from '@material-ui/core';
import {createApolloClient} from '../../graphql/apolloClient';
import {STEPS, STATUS} from '../../utils/constants';
import StyleStep from './StyleStep';
import TrainStep from './TrainStep';
import GenerateStep from './GenerateStep';
import WizardNavigation from './WizardNavigation';
import ErrorBanner from './ErrorBanner';
import './ExactlyImageGeneratorApp.css';

const apolloClient = createApolloClient();

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
    const canProgress = useCallback(() => {
        switch (currentStep) {
            case STEPS.STYLE:
                return selectedStyleUuid !== null;
            case STEPS.TRAIN:
                // Can only progress to Generate if model is READY
                return selectedStyleStatus === STATUS.READY;
            case STEPS.GENERATE:
                return false; // Final step
            default:
                return false;
        }
    }, [currentStep, selectedStyleUuid, selectedStyleStatus]);

    const handleNext = useCallback(() => {
        if (canProgress()) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.GENERATE));
        }
    }, [canProgress]);

    const handleBack = useCallback(() => {
        setCurrentStep(prev => Math.max(prev - 1, STEPS.STYLE));
    }, []);

    const handleReset = useCallback(() => {
        setShowResetDialog(true);
    }, []);

    const confirmReset = useCallback(() => {
        setCurrentStep(STEPS.STYLE);
        setSelectedStyleUuid(null);
        setSelectedStyleName('');
        setSelectedStyleStatus(STATUS.UNKNOWN);
        setSelectedStyleDescription('');
        setGeneratedUrls([]);
        setGlobalError(null);
        setShowResetDialog(false);
    }, []);
    
    const handleStyleSelect = useCallback((uuid, name, status, description) => {
        setSelectedStyleUuid(uuid);
        setSelectedStyleName(name);
        setSelectedStyleStatus(status || STATUS.UNKNOWN);
        setSelectedStyleDescription(description || '');
    }, []);
    
    const handleStepClick = useCallback((step) => {
        // Step 3 (Generate) is ONLY accessible when model status is READY
        if (step === STEPS.GENERATE && selectedStyleStatus !== STATUS.READY) {
            return; // Block access to Generate step if model is not ready
        }
        
        // Can go back to any previous step (except Generate if not ready)
        if (step <= currentStep) {
            setCurrentStep(step);
            return;
        }
        
        // Forward navigation: can jump to Generate if model is ready
        if (step === STEPS.GENERATE && selectedStyleStatus === STATUS.READY) {
            setCurrentStep(step);
            return;
        }
        
        // Otherwise, can only move to next step if canProgress allows it
        if (step === currentStep + 1 && canProgress()) {
            setCurrentStep(step);
        }
    }, [currentStep, selectedStyleStatus, canProgress]);
    
    const handleGenerationComplete = useCallback((_projectUuid, urls) => {
        setGeneratedUrls(urls);
    }, []);
    
    const handleError = useCallback((error) => {
        setGlobalError(error);
    }, []);
    
    const handleDismissError = useCallback(() => {
        setGlobalError(null);
    }, []);
    
    // Memoized wizard steps
    const wizardSteps = useMemo(() => [
        {id: STEPS.STYLE, label: t('steps.style')},
        {id: STEPS.TRAIN, label: t('steps.train')},
        {id: STEPS.GENERATE, label: t('steps.generate')}
    ], [t]);

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
                            onDismiss={handleDismissError}
                        />
                    )}

                    {/* Wizard Navigation */}
                    <WizardNavigation
                        currentStep={currentStep}
                        steps={wizardSteps}
                        onStepClick={handleStepClick}
                        canProgress={canProgress()}
                        selectedStyleStatus={selectedStyleStatus}
                    />

                    {/* Step Content */}
                    <div className="exactly-app__content">
                    {currentStep === STEPS.STYLE && (
                        <StyleStep
                            selectedStyleUuid={selectedStyleUuid}
                            selectedStyleName={selectedStyleName}
                            onStyleSelect={handleStyleSelect}
                            onError={handleError}
                        />
                    )}

                    {currentStep === STEPS.TRAIN && (
                        <TrainStep
                            styleUuid={selectedStyleUuid}
                            styleName={selectedStyleName}
                            styleStatus={selectedStyleStatus}
                            styleDescription={selectedStyleDescription}
                            onTrainComplete={() => {/* Training complete */}}
                            onError={handleError}
                        />
                    )}

                    {currentStep === STEPS.GENERATE && (
                        <GenerateStep
                            styleUuid={selectedStyleUuid}
                            styleName={selectedStyleName}
                            styleDescription={selectedStyleDescription}
                            generatedUrls={generatedUrls}
                            onGenerationComplete={handleGenerationComplete}
                            onError={handleError}
                        />
                    )}
                </div>
                </div>
            </div>
    );
};

export default ExactlyImageGeneratorApp;
