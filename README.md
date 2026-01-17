# Exactly.ai Image Generator - Jahia Module

A complete Jahia OSGi module for integrating Exactly.ai image generation capabilities into Jahia DXP. This module provides a secure server-side proxy, JCR persistence, GraphQL API, and React UI for training custom models and generating AI images.

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [GraphQL API](#graphql-api)
- [Security](#security)
- [Development](#development)

---

## Features

✅ **Server-Side Proxy** - Secure API calls to Exactly.ai without exposing tokens to the browser  
✅ **JCR Persistence** - Store styles and projects with full metadata  
✅ **GraphQL-First Design** - Complete GraphQL API for all operations  
✅ **React UI** - Three-step wizard interface with visual feedback  
✅ **Jahia Media Manager Integration** - Direct integration with Jahia Media Manager for training and saving images  
✅ **Streaming Support** - Efficient handling of image uploads/downloads  
✅ **OSGi Configuration** - External configuration for API credentials  
✅ **Real-Time Training Progress** - Live polling of training status with circular progress indicator  
✅ **Style Management** - Sync, create, train, and manage custom Exactly.ai models  
✅ **Clickable Wizard Navigation** - Jump to any completed step in the workflow  
✅ **Status Badges** - Visual indicators for model status (draft, training, ready, failed)  
✅ **Style Descriptions** - Store and display custom descriptions for each style  

---

## Architecture

### Package Structure

```
org.jahia.se.modules.exactlyImageGenerator/
├── cfg/                    # OSGi configuration handler
├── proxy/                  # HTTP client for Exactly API
├── services/               # Business logic layer
│   ├── ExactlyService      # High-level API wrapper
│   ├── DamService          # Jahia Media Manager operations
│   ├── JcrStyleRepository  # Style persistence
│   └── JcrProjectRepository # Project persistence
└── graphql/                # GraphQL schema and resolvers
    └── ExactlyMutations    # GraphQL mutations
```

### JCR Node Types

**eximgnt:style** - Stores Exactly style/model references
```
- eximg:exactlyId (string)      # Remote style ID
- eximg:name (string)           # Display name
- eximg:description (string)    # Custom style description
- eximg:status (string)         # unknown|draft|active|training|ready|failed
- eximg:active (boolean)        # Whether style is active
- eximg:lastSynced (date)       # Last sync timestamp
- eximg:metadata (string)       # JSON metadata
- eximg:params (string)         # JSON parameters
```

**eximg:project** - Stores training/generation jobs
```
- eximg:type (string)                    # training|generation
- eximgnt:styleUuid (string)               # Reference to style
- eximg:prompt (string)                  # Generation prompt
- eximg:status (string)                  # pending|processing|completed|failed
- eximg:paramsJson (string)              # JSON parameters
- eximg:metadata (string)                # JSON metadata
- eximg:remoteJobId (string)             # Remote job reference
- eximg:generatedRemoteUrls (string[])   # Generated image URLs
- eximg:generatedAssetUuids (string[])   # Linked Media Manager assets
- eximg:createdAt (date)                 # Creation timestamp
- eximg:updatedAt (date)                 # Last update timestamp
```

### Data Flow

```
React UI (Browser)
    ↓ GraphQL Mutation
GraphQL Resolvers
    ↓ Business Logic
Services Layer
    ↓ HTTP/JCR Operations
Exactly API + JCR Repository
```

**Key Security Feature**: The browser NEVER calls Exactly API directly. All API calls go through the server-side proxy which injects the Bearer token.

---

## Installation

### Prerequisites

- Jahia 8.2.0.0 or higher
- Node.js 14.16.0+ and Yarn 1.22.11+
- Maven 3.6+
- Exactly.ai API token (get from https://exactly.ai)

### Build the Module

```bash
cd exactlyImageGenerator
mvn clean install
```

This will:
1. Install Node.js and Yarn via frontend-maven-plugin
2. Build the React UI
3. Compile Java classes
4. Package as OSGi bundle

### Deploy to Jahia

```bash
# Copy to Jahia digital-factory-data directory
cp target/exactlyImageGenerator-1.0.0-SNAPSHOT.jar \
   /path/to/jahia/digital-factory-data/modules/

# Or use Maven deploy
mvn jahia:deploy
```

The module will auto-start and register all OSGi services.

---

## Configuration

### OSGi Configuration File

Edit or create: `digital-factory-data/karaf/etc/org.jahia.se.modules.exactlyImageGenerator.cfg`

```properties
# Exactly.ai API Token (required)
exactly.api.token=YOUR_API_TOKEN_HERE

# API Base URL (optional, defaults to https://api.exactly.ai)
exactly.api.baseUrl=https://api.exactly.ai

# API Path (optional, defaults to public)
exactly.api.path=public

# API Version (optional, defaults to v1)
exactly.api.version=v1
```

**Important**: Never commit the `.cfg` file with real tokens to version control.

**Note**: The path and version settings allow you to adapt to future Exactly.ai API changes without modifying code. Endpoints are constructed as: `{baseUrl}/{path}/{version}/{resource}`

### Configuration Management

The module includes a template configuration file at:
```
src/main/resources/META-INF/configurations/org.jahia.se.modules.exactlyImageGenerator.cfg
```

This file contains default/example values and will be deployed with the module.

### Hot Reload

Changes to the `.cfg` file are picked up automatically by OSGi. No restart required.

---

## Usage

### Access the Admin Panel

1. Log in to Jahia as an administrator
2. Navigate to: **Administration → Exactly.ai Image Generator**
3. The React UI will load with a three-step wizard interface

### Wizard Interface

The UI provides a guided workflow with three main steps:

#### Step 1: Select Style

- View all synced styles from your Exactly.ai account
- Click **"Sync Styles"** to refresh from the API
- See style descriptions and status badges (draft, training, ready, failed)
- Select a style to proceed to training or generation

#### Step 2: Train Model

- Upload training images from Jahia Media Manager by entering asset paths
- View existing training images already uploaded to Exactly.ai
- Start model training with the **"Train Model"** button
- Monitor real-time training progress with circular progress indicator
- Training status automatically updates every 5 seconds
- Cancel training if needed
- Status badge displays current model state in top right corner

#### Step 3: Generate & Save

- Enter a descriptive prompt for image generation
- Configure parameters:
  - Number of variations (1-8)
  - Aspect ratio (9:16, 2:3, 3:4, 1:1, 4:3, 3:2, 16:9)
- View generated images in a grid
- Select which images to save to Jahia Media Manager
- Choose target folder path for saved assets

### Navigation Features

- **Clickable Step Cards**: Jump directly to any completed step
- **Visual Feedback**: Active step highlighted, completed steps marked with checkmark
- **Protected Step 3**: Generate step only accessible when model status is READY
- **Status Indicators**: Color-coded badges show model status throughout workflow
- **Auto-Refresh**: Image lists automatically refresh after upload/delete operations

---

## GraphQL API

### Mutations

#### syncStyles
Sync styles from Exactly API to JCR, extracting descriptions from metadata
```graphql
mutation SyncExactlyStyles($siteKey: String!) {
  exactly {
    syncStyles(siteKey: $siteKey) {
      successful
      message
    }
  }
}
```

#### getModel
Fetch model details from Exactly.ai
```graphql
mutation GetModel($styleUuid: String!) {
  exactly {
    getModel(styleUuid: $styleUuid) {
      successful
      message
    }
  }
}
```

#### uploadTrainingImages
Upload Jahia Media Manager assets as training images to Exactly.ai
```graphql
mutation UploadTrainingImages($styleUuid: String!, $damAssetUuids: [String!]!) {
  exactly {
    uploadTrainingImages(styleUuid: $styleUuid, damAssetUuids: $damAssetUuids) {
      successful
      message
    }
  }
}
```

#### getTrainingImages
Retrieve existing training images for a style
```graphql
mutation GetTrainingImages($styleUuid: String!) {
  exactly {
    getTrainingImages(styleUuid: $styleUuid) {
      successful
      message
    }
  }
}
```

#### trainStyle
Start model training with uploaded images
```graphql
mutation TrainExactlyStyle($styleUuid: String!) {
  exactly {
    trainStyle(styleUuid: $styleUuid) {
      successful
      message
    }
  }
}
```

#### getTrainingProgress
Check training progress (polled every 5 seconds during training)
```graphql
mutation GetTrainingProgress($styleUuid: String!) {
  exactly {
    getTrainingProgress(styleUuid: $styleUuid) {
      successful
      message
    }
  }
}
```

#### cancelTraining
Cancel an ongoing training job
```graphql
mutation CancelTraining($styleUuid: String!) {
  exactly {
    cancelTraining(styleUuid: $styleUuid) {
      successful
      message
    }
  }
}
```

#### putModelToDraft
Reset a trained model back to draft status
```graphql
mutation PutModelToDraft($styleUuid: String!) {
  exactly {
    putModelToDraft(styleUuid: $styleUuid) {
      successful
      message
    }
  }
}
```

#### generateImages
Generate images from a trained style and prompt
```graphql
mutation GenerateExactlyImages(
  $styleUuid: String!
  $prompt: String!
  $numImages: Int
  $width: Int
  $height: Int
) {
  exactly {
    generateImages(
      styleUuid: $styleUuid
      prompt: $prompt
      numImages: $numImages
      width: $width
      height: $height
    ) {
      successful
      message
    }
  }
}
```

#### saveGeneratedImagesToDam
Save selected generated images to Jahia Media Manager
```graphql
mutation SaveGeneratedImagesToDam(
  $projectUuid: String!
  $imageUrls: [String!]!
  $targetFolder: String!
) {
  exactly {
    saveGeneratedImagesToDam(
      projectUuid: $projectUuid
      imageUrls: $imageUrls
      targetFolder: $targetFolder
    ) {
      successful
      message
    }
  }
}
```

### Queries

Use Jahia's built-in GraphQL for reading JCR nodes:

```graphql
query GetStyles {
  jcr {
    nodeByPath(path: "/sites/systemsite/contents/exactly-styles") {
      children(typeName: "eximgnt:style") {
        nodes {
          uuid
          properties { name value }
        }
      }
    }
  }
}
```

See [GRAPHQL_OPERATIONS.md](./GRAPHQL_OPERATIONS.md) for complete examples.

---

## Security

### Token Protection

✅ API token stored in OSGi configuration (server-side only)  
✅ Never exposed to browser or client-side JavaScript  
✅ All Exactly API calls proxied through server  
✅ Authorization header injected server-side  

### Permission Checks

All GraphQL mutations enforce:
- User must be authenticated
- User must have READ permission on source Media Manager assets
- User must have CREATE permission on target Media Manager folders

### Logging

Sensitive data is excluded from logs:
```java
logger.info("Exactly API token configured (length: {})", token.length());
// Never logs the actual token
```

---

## Development

### Code Architecture (2026 Refactoring)

The React UI has been refactored with a clean, modular architecture:

**utils/** - Pure utility functions
- `constants.js` - Centralized constants (STEPS, STATUS, ASPECT_RATIOS, etc.)
- `jahiaHelpers.js` - Jahia integration utilities
- `imageHelpers.js` - Image processing and validation
- `responseParser.js` - Safe API response parsing
- `pickerHelpers.js` - Content picker integration
- `progressHelpers.js` - Progress tracking and simulation

**hooks/** - Custom React hooks
- `useTraining.js` - Training operations (upload, delete, start, progress polling)
- `useGeneration.js` - Generation operations (generate, save to Media Manager, selection)

**components/** - React components
- Refactored to use custom hooks and utilities
- Performance optimized with useCallback/useMemo
- Reduced component size by ~30% (TrainStep: 728→513 lines)

See `REFACTORING_INDEX.md` for complete documentation.

### Project Structure

```
exactlyImageGenerator/
├── pom.xml                                 # Maven configuration
├── babel.config.js                         # React/Babel config
├── webpack.config.js                       # React build config
├── package.json                            # NPM dependencies
├── src/
│   ├── main/
│   │   ├── java/org/jahia/se/modules/exactlyImageGenerator/
│   │   │   ├── cfg/                        # Configuration
│   │   │   ├── proxy/                      # HTTP client
│   │   │   ├── services/                   # Business logic
│   │   │   └── graphql/                    # GraphQL API
│   │   └── resources/
│   │       └── META-INF/
│   │           ├── definitions.cnd         # JCR node types
│   │           ├── graphql/
│   │           │   └── exactly.graphqls    # GraphQL schema
│   │           └── configurations/
│   │               └── org.jahia.se.modules.exactlyImageGenerator.cfg
│   └── javascript/
│       ├── AdminPanel/                     # React UI
│       │   ├── components/                 # React components
│       │   │   ├── ExactlyImageGeneratorApp.jsx   # Main wizard
│       │   │   ├── StyleStep.jsx           # Step 1: Style selection
│       │   │   ├── TrainStep.jsx           # Step 2: Training
│       │   │   ├── GenerateStep.jsx        # Step 3: Generation
│       │   │   ├── WizardNavigation.jsx    # Wizard nav
│       │   │   ├── StatusBadge.jsx         # Status indicators
│       │   │   ├── CircularProgress.jsx    # Progress indicator
│       │   │   └── ErrorBanner.jsx         # Error display
│       │   └── AdminPanel.jsx              # Panel registration
│       ├── api/
│       │   └── exactlyApi.js               # REST API client
│       ├── graphql/
│       │   ├── apolloClient.js             # Apollo setup
│       │   └── operations.js               # GraphQL operations
│       ├── hooks/                          # Custom React hooks
│       │   ├── useTraining.js              # Training operations
│       │   └── useGeneration.js            # Generation operations
│       └── utils/                          # Utility functions
│           ├── constants.js                # App constants
│           ├── jahiaHelpers.js             # Jahia integration
│           ├── imageHelpers.js             # Image processing
│           ├── responseParser.js           # API response parsing
│           ├── pickerHelpers.js            # Content picker
│           └── progressHelpers.js          # Progress tracking
└── target/                                 # Build output
```

### Building

```bash
# Development build (faster, unminified)
mvn clean install -Pdev

# Production build (optimized)
mvn clean install
```

### Testing GraphQL

Access the GraphQL playground:
```
http://localhost:8080/modules/graphql
```

### Debugging

Enable debug logging in Karaf:
```
log:set DEBUG org.jahia.se.modules.exactlyImageGenerator
```

View logs:
```
log:tail
```

### React Development

For faster React development:

```bash
cd src/javascript
yarn install
yarn build:dev
```

Changes to React files require rebuilding the module.

---

## API Reference

### Exactly.ai API Endpoints Used

Based on https://api.exactly.ai/public/docs/

- `GET /models` - List all models/styles
- `GET /models/{uid}` - Get model details
- `POST /models` - Create new model
- `POST /models/{uid}/images` - Upload training images (multipart)
- `POST /models/{uid}/train` - Start training
- `GET /models/{uid}/train/progress` - Get training progress (polled every 5s)
- `POST /models/{uid}/train/cancel` - Cancel training
- `PUT /models/{uid}/draft` - Put model back to draft
- `POST /models/{uid}/generate` - Generate images with trained model

### Java Services

**ExactlyConfiguration**
```java
String getApiToken()
String getApiBaseUrl()
boolean isConfigured()
```

**ExactlyProxyClient**
```java
String get(String endpoint)
String post(String endpoint, String jsonBody)
String postMultipart(String endpoint, Map<String, InputStream> files, Map<String, String> fields)
InputStream getStream(String endpoint)
InputStream getStreamFromUrl(String absoluteUrl)
```

**ExactlyService**
```java
List<Map<String, Object>> listStyles()
Map<String, Object> getModel(String modelUid)
Map<String, Object> uploadTrainingImages(String styleId, List<String> damAssetUuids)
Map<String, Object> trainStyle(String styleId)
Map<String, Object> getTrainingProgress(String modelUid)
Map<String, Object> cancelTraining(String modelUid)
Map<String, Object> putModelToDraft(String modelUid)
Map<String, Object> generateImages(String styleId, String prompt, String paramsJson)
List<Map<String, Object>> getTrainingImages(String modelUid)
InputStream downloadImage(String url)
```

**DamService**
```java
InputStream getDamAssetStream(String assetUuid)
Node createDamAsset(String targetFolderPath, String fileName, String mimeType, InputStream inputStream, String title)
Node createDamAssetByFolderUuid(String targetFolderUuid, String fileName, String mimeType, InputStream inputStream, String title)
```

**JcrStyleRepository**
```java
Node findOrCreateStyle(String exactlyId, String name, String status, Boolean active, String description, String metadata)
Node updateStyle(String uuid, String name, String status, Boolean active, String description, String metadata)
String getExactlyId(String uuid)
Node getStyleByUuid(String uuid)
List<Node> listAllStyles()
```

**JcrProjectRepository**
```java
Node createProject(String type, String styleUuid, String prompt, String paramsJson)
Node updateProjectStatus(String uuid, String status, String metadata)
Node storeGeneratedUrls(String uuid, List<String> urls)
Node linkGeneratedAssets(String uuid, List<String> assetUuids)
```

---

## Troubleshooting

### Module doesn't start
- Check OSGi console: `bundle:list | grep exactly`
- Check logs: `log:tail`
- Verify all dependencies are available

### API calls fail
- Verify token in `.cfg` file
- Check network connectivity to api.exactly.ai
- Enable debug logging: `log:set DEBUG org.jahia.se.modules.exactlyImageGenerator.proxy`

### GraphQL errors
- Access GraphQL playground: http://localhost:8080/modules/graphql
- Test mutations manually
- Check user permissions

### Images not saving to Jahia Media Manager
- Verify target folder exists
- Check user has CREATE permission
- Verify URLs are accessible from server

---

## License

MIT License - See LICENSE file

---

## Support

For issues and questions:
- Check the logs: `log:tail`
- Review GraphQL operations: [GRAPHQL_OPERATIONS.md](./GRAPHQL_OPERATIONS.md)
- Consult Exactly.ai API docs: https://api.exactly.ai/public/docs/

---

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Follow existing code style
4. Add tests for new features
5. Submit a pull request

---

## Roadmap

Recent additions:
- [x] Real-time training progress monitoring with polling
- [x] Clickable wizard navigation
- [x] Visual status badges throughout UI
- [x] Style description storage and display
- [x] Model status synchronization
- [x] Training cancellation support
- [x] Put model to draft functionality
- [x] Complete code refactoring with utils and custom hooks
- [x] Auto-refresh image lists after upload/delete
- [x] Step 3 access restricted to READY models only

Code Quality Improvements (2026):
- [x] Modular architecture with utils/ and hooks/ separation
- [x] Custom React hooks (useTraining, useGeneration)
- [x] Performance optimization (useCallback, useMemo)
- [x] Centralized constants and helpers
- [x] Comprehensive code documentation (see REFACTORING_*.md files)

Future enhancements:
- [ ] Batch image generation
- [ ] Custom parameter presets
- [ ] Training dataset management UI
- [ ] Generation history view
- [ ] Image editing before saving
- [ ] Multi-site support
- [ ] Advanced filtering and search for styles
- [ ] Image variation controls

---

Built with ❤️ for Jahia DXP
