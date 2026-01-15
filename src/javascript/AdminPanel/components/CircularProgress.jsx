/**
 * Circular Progress Component
 * Displays a circular progress indicator with percentage and color changes
 */

import React from 'react';
import './CircularProgress.css';

const CircularProgress = ({progress, size = 120, strokeWidth = 10}) => {
    // Normalize progress to 0-100
    const normalizedProgress = Math.min(100, Math.max(0, progress || 0));
    
    // Calculate circle properties
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (normalizedProgress / 100) * circumference;
    
    // Determine color based on progress
    const getColor = (progress) => {
        if (progress < 25) return '#ff6b6b'; // Red
        if (progress < 50) return '#ffa726'; // Orange
        if (progress < 75) return '#ffd93d'; // Yellow
        if (progress < 100) return '#42a5f5'; // Blue
        return '#4caf50'; // Green for complete
    };
    
    const color = getColor(normalizedProgress);
    const isComplete = normalizedProgress === 100;
    
    return (
        <div className="circular-progress" style={{width: size, height: size}}>
            <svg
                className="circular-progress__svg"
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
            >
                {/* Background circle */}
                <circle
                    className="circular-progress__bg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                
                {/* Progress circle */}
                <circle
                    className={`circular-progress__bar ${isComplete ? 'complete' : ''}`}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    stroke={color}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            
            {/* Percentage text */}
            <div className="circular-progress__text" style={{color: color}}>
                <span className="circular-progress__number">{normalizedProgress}</span>
                <span className="circular-progress__percent">%</span>
            </div>
        </div>
    );
};

export default CircularProgress;
