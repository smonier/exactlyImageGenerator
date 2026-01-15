# Exactly.ai Image Generator - Sample GraphQL Operations

This document provides complete examples of all GraphQL operations for the Exactly.ai Image Generator module.

## Table of Contents
1. [Mutations](#mutations)
2. [Queries](#queries)
3. [Usage Examples](#usage-examples)

---

## Mutations

### 1. Sync Styles from Exactly API

Fetches all styles from the Exactly API and stores/updates them in JCR.

```graphql
mutation SyncExactlyStyles {
  syncExactlyStyles {
    updatedStyles {
      uuid
      exactlyId
      name
      status
      lastSynced
      metadataJson
    }
    message
  }
}
```

**Response:**
```json
{
  "data": {
    "syncExactlyStyles": {
      "updatedStyles": [
        {
          "uuid": "abc-123",
          "exactlyId": "style-456",
          "name": "My Style",
          "status": "active",
          "lastSynced": "2026-01-14T10:30:00.000Z",
          "metadataJson": "{...}"
        }
      ],
      "message": "Successfully synced 5 styles"
    }
  }
}
```

---

### 2. Train Style with DAM Assets

Upload training images from DAM and start training a style.

```graphql
mutation TrainExactlyStyle($styleUuid: String!, $damAssetUuids: [String!]!) {
  trainExactlyStyle(
    styleNodeUuid: $styleUuid
    damAssetUuids: $damAssetUuids
  ) {
    projectUuid
    remoteJobId
    status
    message
  }
}
```

**Variables:**
```json
{
  "styleUuid": "abc-123",
  "damAssetUuids": [
    "dam-asset-uuid-1",
    "dam-asset-uuid-2",
    "dam-asset-uuid-3"
  ]
}
```

**Response:**
```json
{
  "data": {
    "trainExactlyStyle": {
      "projectUuid": "project-789",
      "remoteJobId": "job-xyz-123",
      "status": "processing",
      "message": "Training started successfully"
    }
  }
}
```

---

### 3. Generate Images from Prompt

Generate images using a trained style and a prompt.

```graphql
mutation GenerateExactlyImages(
  $styleUuid: String!
  $prompt: String!
  $params: String
) {
  generateExactlyImages(
    styleNodeUuid: $styleUuid
    prompt: $prompt
    paramsJson: $params
  ) {
    projectUuid
    status
    generatedRemoteUrls
    message
  }
}
```

**Variables:**
```json
{
  "styleUuid": "abc-123",
  "prompt": "A beautiful sunset over mountains",
  "params": "{\"num_images\": 4, \"quality\": \"high\"}"
}
```

**Response:**
```json
{
  "data": {
    "generateExactlyImages": {
      "projectUuid": "project-gen-456",
      "status": "completed",
      "generatedRemoteUrls": [
        "https://exactly.ai/images/gen-1.png",
        "https://exactly.ai/images/gen-2.png",
        "https://exactly.ai/images/gen-3.png",
        "https://exactly.ai/images/gen-4.png"
      ],
      "message": "Generation completed"
    }
  }
}
```

---

### 4. Save Generated Images to DAM

Download generated images and save them as DAM assets.

```graphql
mutation SaveGeneratedImagesToDam(
  $projectUuid: String!
  $folderPath: String
  $folderUuid: String
  $selection: [GeneratedImageSelectionInput!]!
) {
  saveGeneratedImagesToDam(
    projectNodeUuid: $projectUuid
    targetFolderPath: $folderPath
    targetFolderUuid: $folderUuid
    selection: $selection
  ) {
    projectUuid
    assets {
      uuid
      path
      name
    }
    message
  }
}
```

**Variables (using folder path):**
```json
{
  "projectUuid": "project-gen-456",
  "folderPath": "/sites/digitall/files/generated-images",
  "selection": [
    {
      "remoteUrl": "https://exactly.ai/images/gen-1.png",
      "fileName": "sunset-mountains-1.png",
      "title": "Sunset over Mountains - Version 1"
    },
    {
      "remoteUrl": "https://exactly.ai/images/gen-2.png",
      "fileName": "sunset-mountains-2.png",
      "title": "Sunset over Mountains - Version 2"
    }
  ]
}
```

**Variables (using folder UUID):**
```json
{
  "projectUuid": "project-gen-456",
  "folderUuid": "folder-uuid-789",
  "selection": [
    {
      "remoteUrl": "https://exactly.ai/images/gen-1.png",
      "fileName": "generated-image-1.png"
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "saveGeneratedImagesToDam": {
      "projectUuid": "project-gen-456",
      "assets": [
        {
          "uuid": "asset-new-123",
          "path": "/sites/digitall/files/generated-images/sunset-mountains-1.png",
          "name": "sunset-mountains-1.png"
        },
        {
          "uuid": "asset-new-456",
          "path": "/sites/digitall/files/generated-images/sunset-mountains-2.png",
          "name": "sunset-mountains-2.png"
        }
      ],
      "message": "Successfully saved 2 images to DAM"
    }
  }
}
```

---

## Queries

Use Jahia's built-in GraphQL for reading JCR data.

### 1. Get All Styles

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

### 2. Get Style by UUID

```graphql
query GetStyleByUuid($uuid: String!) {
  jcr {
    nodeById(uuid: $uuid) {
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
```

**Variables:**
```json
{
  "uuid": "abc-123"
}
```

### 3. Get All Projects

```graphql
query GetProjects {
  jcr {
    nodeByPath(path: "/sites/systemsite/contents/exactly-projects") {
      children(typeName: "eximg:project") {
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

### 4. Get Project by UUID

```graphql
query GetProjectByUuid($uuid: String!) {
  jcr {
    nodeById(uuid: $uuid) {
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
```

---

## Usage Examples

### Complete Workflow Example

#### Step 1: Sync Styles

```javascript
import { useMutation } from '@apollo/client';
import { SYNC_EXACTLY_STYLES } from './graphql/operations';

function SyncButton() {
  const [syncStyles, { loading, error, data }] = useMutation(SYNC_EXACTLY_STYLES);

  const handleSync = async () => {
    try {
      const result = await syncStyles();
      console.log('Synced:', result.data.syncExactlyStyles);
      alert(result.data.syncExactlyStyles.message);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  return (
    <button onClick={handleSync} disabled={loading}>
      {loading ? 'Syncing...' : 'Sync Styles'}
    </button>
  );
}
```

#### Step 2: Train Style

```javascript
import { useMutation } from '@apollo/client';
import { TRAIN_EXACTLY_STYLE } from './graphql/operations';

function TrainButton({ styleUuid, selectedAssets }) {
  const [trainStyle, { loading }] = useMutation(TRAIN_EXACTLY_STYLE);

  const handleTrain = async () => {
    try {
      const result = await trainStyle({
        variables: {
          styleUuid: styleUuid,
          damAssetUuids: selectedAssets // Array of DAM asset UUIDs
        }
      });
      
      console.log('Training started:', result.data.trainExactlyStyle);
      alert(`Training started! Project: ${result.data.trainExactlyStyle.projectUuid}`);
    } catch (err) {
      console.error('Training failed:', err);
    }
  };

  return (
    <button onClick={handleTrain} disabled={loading || !styleUuid || selectedAssets.length === 0}>
      {loading ? 'Starting Training...' : 'Train Style'}
    </button>
  );
}
```

#### Step 3: Generate Images

```javascript
import { useMutation } from '@apollo/client';
import { GENERATE_EXACTLY_IMAGES } from './graphql/operations';

function GenerateButton({ styleUuid, prompt }) {
  const [generateImages, { loading, data }] = useMutation(GENERATE_EXACTLY_IMAGES);

  const handleGenerate = async () => {
    try {
      const result = await generateImages({
        variables: {
          styleUuid: styleUuid,
          prompt: prompt,
          params: JSON.stringify({ num_images: 4 })
        }
      });
      
      const urls = result.data.generateExactlyImages.generatedRemoteUrls;
      console.log('Generated images:', urls);
      
      // Display images in UI
      setGeneratedUrls(urls);
      setProjectUuid(result.data.generateExactlyImages.projectUuid);
      
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  return (
    <button onClick={handleGenerate} disabled={loading || !styleUuid || !prompt}>
      {loading ? 'Generating...' : 'Generate Images'}
    </button>
  );
}
```

#### Step 4: Save to DAM

```javascript
import { useMutation } from '@apollo/client';
import { SAVE_GENERATED_IMAGES_TO_DAM } from './graphql/operations';

function SaveButton({ projectUuid, generatedUrls }) {
  const [saveToDam, { loading }] = useMutation(SAVE_GENERATED_IMAGES_TO_DAM);

  const handleSave = async () => {
    // Prepare selection from generated URLs
    const selection = generatedUrls.map((url, index) => ({
      remoteUrl: url,
      fileName: `generated-${Date.now()}-${index}.png`,
      title: `Generated Image ${index + 1}`
    }));

    try {
      const result = await saveToDam({
        variables: {
          projectUuid: projectUuid,
          folderPath: '/sites/digitall/files/exactly-generated',
          selection: selection
        }
      });
      
      const assets = result.data.saveGeneratedImagesToDam.assets;
      console.log('Saved assets:', assets);
      alert(`Saved ${assets.length} images to DAM!`);
      
      // Refresh DAM view or show created assets
      assets.forEach(asset => {
        console.log(`Created: ${asset.path}`);
      });
      
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <button onClick={handleSave} disabled={loading || !projectUuid || generatedUrls.length === 0}>
      {loading ? 'Saving...' : 'Save to DAM'}
    </button>
  );
}
```

---

## Error Handling

All mutations return a `message` field. Check for errors:

```javascript
const [mutation, { loading, error, data }] = useMutation(SOME_MUTATION);

if (error) {
  console.error('GraphQL error:', error);
  alert('Error: ' + error.message);
}

if (data && data.someMutation.message) {
  console.log('Result:', data.someMutation.message);
}
```

---

## Testing with GraphQL Playground

Access Jahia's GraphQL endpoint:
```
http://localhost:8080/modules/graphql
```

Try the mutations in the playground with the examples above.

---

## Notes

- **Authentication**: All mutations require an authenticated Jahia user
- **Permissions**: User must have appropriate permissions on DAM folders
- **Token Security**: The Exactly API token is never exposed to the browser
- **Server-Side Processing**: All image downloads happen server-side
- **Async Operations**: Training and generation may be async; poll status as needed
