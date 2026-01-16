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
✅ **React UI** - Admin panel for managing styles and generating images  
✅ **DAM Integration** - Direct integration with Jahia DAM for training and saving images  
✅ **Streaming Support** - Efficient handling of image uploads/downloads  
✅ **OSGi Configuration** - External configuration for API credentials  

---

## Architecture

### Package Structure

```
org.jahia.se.modules.exactlyImageGenerator/
├── cfg/                    # OSGi configuration handler
├── proxy/                  # HTTP client for Exactly API
├── services/               # Business logic layer
│   ├── ExactlyService      # High-level API wrapper
│   ├── DamService          # DAM operations
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
- eximg:status (string)         # active|training|failed
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
- eximg:generatedAssetUuids (string[])   # Linked DAM assets
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
3. The React UI will load with four main steps

### Workflow

#### Step 1: Sync Styles

Click **"Sync Styles"** to fetch all available styles from your Exactly account and store them in JCR.

```
POST /sites/systemsite/contents/exactly-styles
```

#### Step 2: Train a Style (Optional)

To train a custom style:

1. Select training images from Jahia DAM
2. Provide the style UUID
3. Call `trainExactlyStyle` mutation with DAM asset UUIDs

The module will:
- Read binary data from DAM assets
- Upload to Exactly API (multipart)
- Start training
- Create a project node tracking the training job

#### Step 3: Generate Images

1. Select a trained style (enter UUID)
2. Write a descriptive prompt
3. Click **"Generate Images"**

The module will:
- Call Exactly's generate endpoint
- Store result URLs in a project node
- Display generated images in the UI

#### Step 4: Save to DAM

Select which generated images to save and click **"Save to DAM"**

The module will:
- Download each image server-side
- Create DAM assets (jnt:file nodes)
- Link assets back to the project node

---

## GraphQL API

### Mutations

#### syncExactlyStyles
Sync styles from Exactly API to JCR
```graphql
mutation {
  syncExactlyStyles {
    updatedStyles { uuid name status }
    message
  }
}
```

#### trainExactlyStyle
Upload training images and start training
```graphql
mutation TrainStyle($styleUuid: String!, $assets: [String!]!) {
  trainExactlyStyle(styleNodeUuid: $styleUuid, damAssetUuids: $assets) {
    projectUuid
    remoteJobId
    status
    message
  }
}
```

#### generateExactlyImages
Generate images from a prompt
```graphql
mutation Generate($styleUuid: String!, $prompt: String!) {
  generateExactlyImages(styleNodeUuid: $styleUuid, prompt: $prompt) {
    projectUuid
    status
    generatedRemoteUrls
    message
  }
}
```

#### saveGeneratedImagesToDam
Save generated images to DAM
```graphql
mutation SaveToDam($projectUuid: String!, $folderPath: String!, $selection: [GeneratedImageSelectionInput!]!) {
  saveGeneratedImagesToDam(
    projectNodeUuid: $projectUuid
    targetFolderPath: $folderPath
    selection: $selection
  ) {
    projectUuid
    assets { uuid path name }
    message
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
- User must have READ permission on source DAM assets
- User must have CREATE permission on target DAM folders

### Logging

Sensitive data is excluded from logs:
```java
logger.info("Exactly API token configured (length: {})", token.length());
// Never logs the actual token
```

---

## Development

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
│       │   └── AdminPanel.jsx
│       └── graphql/
│           └── operations.js               # GraphQL operations
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

- `GET /styles` - List all styles
- `POST /styles` - Create style
- `POST /styles/{id}/images` - Upload training images (multipart)
- `POST /styles/{id}/train` - Start training
- `GET /styles/{id}/status` - Check training status
- `POST /generate` - Generate images
- `GET /generate/{jobId}` - Check generation status

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
Map<String, Object> uploadTrainingImages(String styleId, List<String> damAssetUuids)
Map<String, Object> trainStyle(String styleId)
Map<String, Object> generateImages(String styleId, String prompt, String paramsJson)
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
Node findOrCreateStyle(String exactlyId, String name, String metadata)
Node updateStyle(String uuid, String name, String status, String metadata)
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

### Images not saving to DAM
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

Future enhancements:
- [ ] Polling mechanism for async jobs
- [ ] Style status monitoring UI
- [ ] Batch image generation
- [ ] Custom parameter presets
- [ ] Training dataset management
- [ ] Generation history view
- [ ] Image editing before saving
- [ ] Multi-site support

---

Built with ❤️ for Jahia DXP
