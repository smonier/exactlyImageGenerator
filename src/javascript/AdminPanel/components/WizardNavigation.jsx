/**
 * Wizard Navigation Component
 * Shows current step and allows navigation
 */

import React from 'react';
import {Typography} from '@jahia/moonstone';
import './WizardNavigation.css';

const stepIcons = {
    0: () => <span>🎨</span>,
    1: () => <span>🚀</span>,
    2: () => <span>☁️</span>
};

const WizardNavigation = ({currentStep, steps, onStepClick}) => {
    return (
        <div className="wizard-nav">
            {steps.map((step, index) => {
                const StepIcon = stepIcons[step.id];
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                    <div
                        key={step.id}
                        className={`wizard-nav__step ${
                            isActive ? 'wizard-nav__step--active' : ''
                        } ${
                            isCompleted ? 'wizard-nav__step--completed' : ''
                        }`}
                        onClick={() => onStepClick(step.id)}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="wizard-nav__step__icon-wrapper">
                            {isCompleted ? (
                                <span className="wizard-nav__check">✓</span>
                            ) : (
                                StepIcon && <StepIcon/>
                            )}
                        </div>
                        <div className="wizard-nav__step__content">
                            <Typography variant="caption" className="wizard-nav__step__number">
                                Step {index + 1}
                            </Typography>
                            <Typography variant="subheading" className="wizard-nav__step__label">
                                {step.label}
                            </Typography>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default WizardNavigation;
