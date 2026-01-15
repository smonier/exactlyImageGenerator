# Exactly.ai Image Generator - REST API

This module uses a REST API instead of GraphQL to avoid schema registration issues with Jahia.

## Endpoints

Base path: `/modules/exactlyImageGenerator/exactly`

### 1. Sync Styles
**POST** `/syncStyles`

Request:
```json
{
  "siteKey": "digitall"
}
```

Response:
```json
{
  "updatedStyles": [
    {
      "uuid": "style-id-123",
      "name": "My Style",
      "status": "trained"
    }
  ],
  "message": "Synced 5 styles"
}
```

### 2. Train Style
**POST** `/trainStyle`

Request:
```json
{
  "siteKey": "digitall",
  "styleUuid": "style-uuid-123",
  "damAssetUuids": ["asset-1", "asset-2", "asset-3"]
}
```

### 3. Generate Images
**POST** `/generateImages`

Request:
```json
{
  "siteKey": "digitall",
  "styleUuid": "style-uuid-123",
  "prompt": "A beautiful landscape",
  "projectName": "My Project",
  "numImages": 4
}
```

Response:
```json
{
  "projectUuid": "project-uuid-456",
  "images": ["url1", "url2", "url3", "url4"],
  "message": "Generated 4 images"
}
```

### 4. Save to DAM
**POST** `/saveToDAM`

Request:
```json
{
  "siteKey": "digitall",
  "imageUrls": ["http://...", "http://..."],
  "targetPath": "/sites/digitall/files/images"
}
```

## Frontend Usage

See `/src/javascript/api/exactlyApi.js` for helper functions:

```javascript
import { syncExactlyStyles, trainExactlyStyle, generateExactlyImages } from './api/exactlyApi';

// Sync styles
const result = await syncExactlyStyles('digitall');

// Train a style
await trainExactlyStyle('digitall', 'style-uuid', ['asset1', 'asset2']);

// Generate images
const generated = await generateExactlyImages('digitall', 'style-uuid', 'a sunset', 'Project 1', 4);
```

## Why REST instead of GraphQL?

GraphQL extension registration was causing schema validation errors that broke the entire Jahia GraphQL system. This simpler REST approach:
- Doesn't interfere with Jahia's GraphQL
- Easier to debug
- More straightforward for simple CRUD operations
- No schema registration issues
