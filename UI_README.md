# Exactly.ai Image Generator - React UI Extension

## Overview

Production-ready React UI extension for Jahia Back Office that provides a complete wizard interface for:
1. **Syncing & selecting** AI styles from Exactly.ai
2. **Training** custom models with DAM assets
3. **Generating** images from prompts
4. **Saving** generated images to Jahia DAM

## Architecture

### Component Structure

```
src/javascript/
├── AdminPanel/
│   ├── AdminPanel.jsx                    # Main wrapper component
│   ├── AdminPanel.css                    # Base styles
│   ├── AdminPanel.register.js            # UI extension registration
│   ├── AdminPanel.routes.jsx             # Route configuration
│   ├── AdminPanel.constants.jsx          # Constants
│   └── components/
│       ├── ExactlyImageGeneratorApp.jsx  # Main wizard app
│       ├── StyleStep.jsx                 # Step 1: Style selection
│       ├── TrainStep.jsx                 # Step 2: Training
│       ├── GenerateStep.jsx              # Step 3: Generation & save
│       ├── WizardNavigation.jsx          # Step navigation
│       ├── ErrorBanner.jsx               # Error display
│       ├── StatusBadge.jsx               # Status indicators
│       └── *.css                         # Component styles
├── graphql/
│   ├── apolloClient.js                   # Apollo Client setup
│   └── operations.js                     # GraphQL queries/mutations
└── locales/
    ├── en.json                           # English translations
    └── fr.json                           # French translations
```

### Technology Stack

- **React 17+** - Component framework
- **Apollo Client** - GraphQL data management
- **Moonstone** - Jahia's component library
- **i18next** - Internationalization
- **CSS Modules** - Component styling

## Features

### ✅ Wizard Flow
- **3-step process** with state persistence
- **Back navigation** without data loss
- **Reset** functionality with confirmation
- **Step indicators** showing progress

### ✅ GraphQL Integration
- All operations via GraphQL (no direct Exactly.ai calls)
- Automatic error handling
- Loading states for all async operations
- Optimistic UI updates where appropriate

### ✅ User Experience
- **Status badges** with color coding
- **Image preview gallery** with selection
- **CORS fallback** for blocked images
- **Inline validation** for all inputs
- **Success notifications** after operations

### ✅ Internationalization
- Complete i18n support
- English locale included
- Easy to add more languages
- Error messages localized

### ✅ Accessibility
- Semantic HTML
- Keyboard navigation support
- Screen reader friendly
- ARIA attributes where needed

## Installation & Setup

### 1. Build the Module

```bash
cd exactlyImageGenerator
mvn clean install
```

The Maven build process will:
- Install Node.js and Yarn
- Install npm dependencies
- Build React app with Webpack
- Bundle everything into the module JAR

### 2. Deploy to Jahia

```bash
cp target/exactlyImageGenerator-1.0.0-SNAPSHOT.jar \
   /path/to/jahia/digital-factory-data/modules/
```

### 3. Access the UI

1. Log into Jahia as administrator
2. Navigate to: **Administration → Exactly.ai Image Generator**
3. The wizard will load automatically

## Usage Guide

### Step 1: Select Style

1. Click **"Sync from Exactly.ai"** to fetch your styles
2. Wait for sync to complete
3. Click on a style card to select it
4. Selected style will be highlighted in blue
5. Click **"Next"** to proceed

### Step 2: Train Model (Optional)

1. Enter DAM asset UUIDs manually (one at a time)
   - *TODO: Replace with Jahia DAM Picker*
2. Added assets shown as chips
3. Click **"Start Training"** when ready
4. Training status displayed with project UUID
5. Click **"Next"** to continue (training is optional)

### Step 3: Generate & Save

1. Enter a descriptive prompt
2. (Optional) Click **"Show Advanced Options"** for JSON params
3. Click **"Generate Images"**
4. Preview generated images in gallery
5. Select images to save (checked by default)
6. Enter target DAM folder path
7. Click **"Save X images to DAM"**
8. Saved assets list displayed with paths

## GraphQL Operations

### Queries

#### GET_STYLES
```graphql
query GetStyles {
  jcr {
    nodeByPath(path: "/sites/systemsite/contents/exactly-styles") {
      children(typeName: "eximgnt:style") {
        nodes {
          uuid
          name
          displayName
          properties {
            name
            value
          }
        }
      }
    }
  }
}
```

### Mutations

#### syncExactlyStyles
```graphql
mutation {
  syncExactlyStyles {
    updatedStyles {
      uuid
      name
      status
    }
    message
  }
}
```

#### trainExactlyStyle
```graphql
mutation TrainStyle($styleUuid: String!, $assets: [String!]!) {
  trainExactlyStyle(
    styleNodeUuid: $styleUuid
    damAssetUuids: $assets
  ) {
    projectUuid
    status
    message
  }
}
```

#### generateExactlyImages
```graphql
mutation Generate($styleUuid: String!, $prompt: String!, $params: String) {
  generateExactlyImages(
    styleNodeUuid: $styleUuid
    prompt: $prompt
    paramsJson: $params
  ) {
    projectUuid
    status
    generatedRemoteUrls
  }
}
```

#### saveGeneratedImagesToDam
```graphql
mutation Save($projectUuid: String!, $folderPath: String!, $selection: [GeneratedImageSelectionInput!]!) {
  saveGeneratedImagesToDam(
    projectNodeUuid: $projectUuid
    targetFolderPath: $folderPath
    selection: $selection
  ) {
    projectUuid
    assets {
      uuid
      path
      name
    }
  }
}
```

## Customization

### Adding Custom Styles

Edit component CSS files in `src/javascript/AdminPanel/components/*.css`

### Modifying i18n

Add/edit translations in `src/main/resources/javascript/locales/*.json`

### Adjusting GraphQL

Modify queries/mutations in `src/javascript/graphql/operations.js`

## Integration Points

### TODO: Jahia DAM Picker

**Location**: `TrainStep.jsx` line ~30

**Current**: Manual UUID input  
**Target**: Integrate Jahia's DAM picker component

```jsx
// Replace this:
<Input
  value={damAssetInput}
  onChange={(e) => setDamAssetInput(e.target.value)}
  placeholder="Enter DAM asset UUID"
/>

// With Jahia DAM picker:
<DamPicker
  multiSelect={true}
  onSelect={(assets) => setDamAssets(assets.map(a => a.uuid))}
/>
```

### TODO: DAM Folder Picker

**Location**: `GenerateStep.jsx` line ~180

**Current**: Manual path input  
**Target**: Folder picker component

```jsx
// Replace with:
<FolderPicker
  initialPath="/sites/systemsite/files/exactly-generated"
  onSelect={(path) => setTargetFolder(path)}
/>
```

## Development

### Local Development

```bash
# Start development build
cd src/javascript
yarn install
yarn build:dev

# Watch mode (if configured)
yarn build:watch
```

### Testing

```bash
# Run unit tests (if configured)
yarn test

# Build production bundle
yarn build:production
```

### Debugging

Enable debug logging in browser console:
```javascript
localStorage.setItem('debug', 'exactly:*');
```

Check React DevTools for component state and props.

## Troubleshooting

### UI doesn't load
- Check browser console for errors
- Verify module is deployed: `bundle:list | grep exactly`
- Check Jahia logs for startup errors

### GraphQL errors
- Open GraphQL playground: `http://localhost:8080/modules/graphql`
- Test mutations manually
- Verify backend services are running

### Images not previewing
- Check browser CORS policy
- Images will show fallback with "Open in new tab" link
- Server-side downloads still work for save operation

### Styles not syncing
- Verify Exactly.ai API token in OSGi config
- Check network tab for failed requests
- Enable debug logging: `log:set DEBUG org.jahia.se.modules.exactlyImageGenerator`

## Security Considerations

✅ **No token exposure** - API token never sent to browser  
✅ **GraphQL only** - All Exactly.ai calls proxied server-side  
✅ **CSRF protection** - Standard Jahia session handling  
✅ **Permission checks** - Enforced by backend mutations  

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- **Lazy loading** for images
- **Memoized components** where beneficial
- **Optimized re-renders** with React.memo
- **Efficient GraphQL caching** with Apollo

## Future Enhancements

- [ ] Real-time training/generation status polling
- [ ] Batch image operations
- [ ] Style templates/presets
- [ ] Advanced parameter builder
- [ ] Image editing before save
- [ ] Generation history view
- [ ] Drag & drop for asset selection
- [ ] Mobile responsive layout

---

**Built with ❤️ for Jahia DXP**

For backend documentation, see [README.md](../../README.md)  
For GraphQL examples, see [GRAPHQL_OPERATIONS.md](../../GRAPHQL_OPERATIONS.md)
