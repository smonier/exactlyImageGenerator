# Refactored Code Quick Reference

## Utility Functions by Category

### Jahia Integration (`utils/jahiaHelpers.js`)
```javascript
import {
    getSiteKey,              // Get current site key
    getUILanguage,           // Get UI language
    isCEAPIAvailable,        // Check if Content Editor API is available
    getDefaultWorkspaceURL,  // Convert path to default workspace URL
    getDefaultTargetFolder   // Generate default target folder path
} from '../utils/jahiaHelpers';

// Example usage:
const siteKey = getSiteKey();
const isAvailable = isCEAPIAvailable();
const imageUrl = getDefaultWorkspaceURL('/sites/mysite/files/image.jpg');
```

### Image Processing (`utils/imageHelpers.js`)
```javascript
import {
    aspectRatioToSize,       // Convert "16:9" to [1024, 576]
    imageUrlToBase64,        // Convert image URL to base64 string
    validateImageSize,       // Check if image meets size requirements
    formatImageDimensions,   // Format as "1024 × 768px"
    generateImageFilename    // Generate timestamped filename
} from '../utils/imageHelpers';

// Example usage:
const [width, height] = aspectRatioToSize('16:9');
const base64 = await imageUrlToBase64(imageUrl);
const isValid = validateImageSize(1920, 1080, 1024);
const displayText = formatImageDimensions(1920, 1080);
```

### API Response Parsing (`utils/responseParser.js`)
```javascript
import {
    parseJSONResponse,         // Safe JSON parsing
    extractModelStatus,        // Parse model status
    extractTrainingProgress,   // Parse training progress
    extractTrainingImages,     // Parse training images
    extractGeneratedImages,    // Parse generated images
    extractErrorMessage        // Extract error message
} from '../utils/responseParser';

// Example usage:
const data = parseJSONResponse(response.message, []);
const status = extractModelStatus(apiResponse);
const progress = extractTrainingProgress(apiResponse);
```

### Progress Tracking (`utils/progressHelpers.js`)
```javascript
import {
    createProgressTracker,   // Initialize progress tracker
    simulateProgress,        // Simulate upload progress
    isTrainingComplete,      // Check if progress >= 100
    isTraining,              // Check if status === 'training'
    isReady                  // Check if status === 'ready'
} from '../utils/progressHelpers';

// Example usage:
const tracker = createProgressTracker(assets, 0);
const controller = simulateProgress(assets, setProgress, onComplete);
controller.stop(); // Stop simulation
controller.complete(); // Mark as complete
```

### Picker Integration (`utils/pickerHelpers.js`)
```javascript
import {
    openImagePicker,      // Open image picker
    openFolderPicker,     // Open folder picker
    filterNewAssets,      // Filter out duplicates
    normalizeAsset        // Normalize asset structure
} from '../utils/pickerHelpers';

// Example usage:
openImagePicker((items) => {
    const newAssets = filterNewAssets(items, existingUuids);
    const normalized = newAssets.map(normalizeAsset);
}, true); // true = allow multiple
```

### Constants (`utils/constants.js`)
```javascript
import {
    STEPS,              // {STYLE: 0, TRAIN: 1, GENERATE: 2}
    ASPECT_RATIOS,      // {'16:9': [1024, 576], ...}
    DEFAULTS,           // {NUM_VARIATIONS: 4, ...}
    STATUS,             // {DRAFT, TRAINING, READY, FAILED}
    IMAGE_REQUIREMENTS  // {MIN_SIZE: 1024, ...}
} from '../utils/constants';

// Example usage:
if (currentStep === STEPS.TRAIN) { /* ... */ }
if (modelStatus === STATUS.READY) { /* ... */ }
const minSize = IMAGE_REQUIREMENTS.MIN_SIZE;
```

## Custom Hooks

### Training Hooks (`hooks/useTraining.js`)

#### useTrainingProgress
```javascript
import {useTrainingProgress} from '../hooks/useTraining';

const {
    trainingStatus,    // Current training status object
    setTrainingStatus, // Update training status
    startPolling,      // Start polling for progress
    stopPolling,       // Stop polling
    fetchProgress      // Manually fetch progress
} = useTrainingProgress(styleUuid);

// trainingStatus shape: {status, progress, message}
```

#### useTrainingImages
```javascript
import {useTrainingImages} from '../hooks/useTraining';

const {
    images,    // Array of training image objects
    loading,   // Loading state
    refetch    // Refetch images function
} = useTrainingImages(styleUuid);
```

#### useStartTraining
```javascript
import {useStartTraining} from '../hooks/useTraining';

const {
    startTraining,  // Function to start training
    loading         // Loading state
} = useStartTraining(
    styleUuid,
    (data) => {/* onSuccess */},
    (error) => {/* onError */}
);

// Call: startTraining()
```

#### useUploadTrainingImages
```javascript
import {useUploadTrainingImages} from '../hooks/useTraining';

const {
    upload,   // Upload function
    loading   // Loading state
} = useUploadTrainingImages(
    styleUuid,
    () => {/* onSuccess */},
    (error) => {/* onError */}
);

// Call: upload(['uuid1', 'uuid2'])
```

#### useDeleteTrainingImage
```javascript
import {useDeleteTrainingImage} from '../hooks/useTraining';

const {
    deleteTrainingImage,  // Delete function
    loading               // Loading state
} = useDeleteTrainingImage(
    styleUuid,
    () => {/* onSuccess */},
    (error) => {/* onError */}
);

// Call: deleteTrainingImage(imageUid)
```

### Generation Hooks (`hooks/useGeneration.js`)

#### useGenerateImages
```javascript
import {useGenerateImages} from '../hooks/useGeneration';

const {
    generate,      // Generate function
    loading,       // Loading state
    projectUuid    // Generated project UUID
} = useGenerateImages(
    styleUuid,
    (jobId, urls) => {/* onSuccess */},
    (error) => {/* onError */}
);

// Call: generate(prompt, numVariations, aspectRatio, referenceImages)
```

#### useSaveToDAM
```javascript
import {useSaveToDAM} from '../hooks/useGeneration';

const {
    save,          // Save function
    loading,       // Loading state
    savedAssets,   // Array of saved assets
    setSavedAssets // Update saved assets
} = useSaveToDAM(
    () => {/* onSuccess */},
    (error) => {/* onError */}
);

// Call: save(projectUuid, selectedIndices, urls, folderPath, prompt)
```

#### useImageSelection
```javascript
import {useImageSelection} from '../hooks/useGeneration';

const {
    selectedImages,   // Array of selected indices
    setSelectedImages, // Set selected images
    toggleImage,      // Toggle image selection
    selectAll,        // Select all images
    clearSelection,   // Clear all selections
    isSelected        // Check if index is selected
} = useImageSelection();

// Examples:
toggleImage(2);           // Toggle image at index 2
selectAll(10);            // Select first 10 images
const selected = isSelected(5); // Check if index 5 is selected
```

## Common Patterns

### Component with Training
```javascript
import React, {useCallback, useMemo} from 'react';
import {useTrainingProgress, useTrainingImages} from '../hooks/useTraining';
import {STATUS} from '../utils/constants';

const MyComponent = ({styleUuid}) => {
    const {trainingStatus} = useTrainingProgress(styleUuid);
    const {images, refetch} = useTrainingImages(styleUuid);
    
    const isTraining = useMemo(() => {
        return trainingStatus?.status === STATUS.TRAINING;
    }, [trainingStatus]);
    
    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);
    
    return (/* JSX */);
};
```

### Component with Image Generation
```javascript
import React, {useCallback, useState} from 'react';
import {useGenerateImages, useImageSelection} from '../hooks/useGeneration';
import {DEFAULTS} from '../utils/constants';

const MyComponent = ({styleUuid}) => {
    const [prompt, setPrompt] = useState('');
    const {selectedImages, toggleImage, selectAll} = useImageSelection();
    
    const {generate, loading} = useGenerateImages(
        styleUuid,
        (jobId, urls) => {
            selectAll(urls.length); // Auto-select all
        },
        (error) => console.error(error)
    );
    
    const handleGenerate = useCallback(() => {
        generate(prompt, DEFAULTS.NUM_VARIATIONS, DEFAULTS.ASPECT_RATIO);
    }, [prompt, generate]);
    
    return (/* JSX */);
};
```

### Component with Progress Simulation
```javascript
import React, {useCallback, useState} from 'react';
import {simulateProgress, createProgressTracker} from '../utils/progressHelpers';

const MyComponent = () => {
    const [progress, setProgress] = useState({});
    
    const handleUpload = useCallback(async (assets) => {
        const controller = simulateProgress(assets, setProgress, () => {
            console.log('Upload complete');
        });
        
        try {
            await uploadMutation(assets);
            controller.complete();
        } catch (error) {
            controller.stop();
        }
    }, []);
    
    return (/* JSX */);
};
```

## Performance Optimization Patterns

### useCallback for Event Handlers
```javascript
// Always wrap handlers in useCallback
const handleClick = useCallback(() => {
    doSomething(dependency);
}, [dependency]);

// Pass to child components
<Button onClick={handleClick} />
```

### useMemo for Computed Values
```javascript
// Memoize expensive computations
const filteredItems = useMemo(() => {
    return items.filter(item => item.active);
}, [items]);

// Memoize conditional logic
const canProceed = useMemo(() => {
    return status === STATUS.READY && items.length > 0;
}, [status, items.length]);
```

### Separate State Management
```javascript
// Instead of one large state object:
const [state, setState] = useState({a: 1, b: 2, c: 3});

// Use separate states:
const [a, setA] = useState(1);
const [b, setB] = useState(2);
const [c, setC] = useState(3);

// Or use custom hooks to encapsulate related state
```

## File Organization

```
src/javascript/
├── utils/
│   ├── constants.js          (All constants)
│   ├── jahiaHelpers.js       (Jahia integration)
│   ├── imageHelpers.js       (Image processing)
│   ├── responseParser.js     (API response parsing)
│   ├── pickerHelpers.js      (Picker utilities)
│   └── progressHelpers.js    (Progress tracking)
├── hooks/
│   ├── useTraining.js        (Training hooks)
│   └── useGeneration.js      (Generation hooks)
├── graphql/
│   ├── apolloClient.js       (Apollo setup)
│   └── operations.js         (GraphQL operations)
└── AdminPanel/
    └── components/
        ├── TrainStep.jsx     (Refactored)
        ├── GenerateStep.jsx  (Refactored)
        └── ExactlyImageGeneratorApp.jsx (Refactored)
```

## Migration Checklist

When refactoring a component:
- [ ] Extract constants to `utils/constants.js`
- [ ] Move helper functions to appropriate `utils/*.js`
- [ ] Create custom hooks for complex state logic
- [ ] Add `useCallback` to all event handlers
- [ ] Add `useMemo` to computed values
- [ ] Import utilities instead of defining inline
- [ ] Update imports to use new structure
- [ ] Test functionality after refactoring
- [ ] Remove old backup files

## Common Gotchas

1. **Hook Dependencies**: Ensure all hook dependencies are listed
2. **Circular Dependencies**: Avoid importing from files that import you
3. **useCallback Without Dependencies**: Will create stale closures
4. **useMemo Overuse**: Only use for expensive computations
5. **Custom Hook State**: Remember hooks create their own state instances

## Additional Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [Performance Optimization](https://react.dev/learn/render-and-commit)
- [Custom Hooks Best Practices](https://react.dev/learn/reusing-logic-with-custom-hooks)
