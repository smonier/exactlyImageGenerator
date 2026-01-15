# Exactly.ai Image Generator - Quick Reference

## 🚀 Quick Start

### 1. Configure
```bash
# Edit OSGi config
vim digital-factory-data/karaf/etc/org.jahia.se.modules.exactlyImageGenerator.cfg
```

```properties
exactly.api.token=YOUR_TOKEN_HERE
exactly.api.baseUrl=https://api.exactly.ai
```

### 2. Build & Deploy
```bash
mvn clean install
cp target/exactlyImageGenerator-1.0.0-SNAPSHOT.jar \
   /path/to/jahia/digital-factory-data/modules/
```

### 3. Access UI
Navigate to: **Administration → Exactly.ai Image Generator**

---

## 📡 GraphQL Endpoints

### GraphQL Playground
```
http://localhost:8080/modules/graphql
```

### 4 Main Mutations

```graphql
# 1. Sync styles
mutation { syncExactlyStyles { message } }

# 2. Train style
mutation TrainStyle($styleUuid: String!, $assets: [String!]!) {
  trainExactlyStyle(styleNodeUuid: $styleUuid, damAssetUuids: $assets) {
    projectUuid
    status
  }
}

# 3. Generate images
mutation Generate($styleUuid: String!, $prompt: String!) {
  generateExactlyImages(styleNodeUuid: $styleUuid, prompt: $prompt) {
    projectUuid
    generatedRemoteUrls
  }
}

# 4. Save to DAM
mutation SaveToDam($projectUuid: String!, $folderPath: String!, $selection: [GeneratedImageSelectionInput!]!) {
  saveGeneratedImagesToDam(
    projectNodeUuid: $projectUuid
    targetFolderPath: $folderPath
    selection: $selection
  ) {
    assets { uuid path name }
  }
}
```

---

## 🗂️ JCR Structure

### Styles Location
```
/sites/systemsite/contents/exactly-styles/
  ├── style-1/            [eximgnt:style]
  ├── style-2/            [eximgnt:style]
  └── style-3/            [eximgnt:style]
```

### Projects Location
```
/sites/systemsite/contents/exactly-projects/
  ├── project-1/          [eximg:project]
  ├── project-2/          [eximg:project]
  └── project-3/          [eximg:project]
```

---

## 🔍 Debugging

### Enable Debug Logging
```bash
# In Karaf console
log:set DEBUG org.jahia.se.modules.exactlyImageGenerator

# View logs
log:tail
```

### Check Bundle Status
```bash
bundle:list | grep exactly
```

### Check Services
```bash
service:list | grep Exactly
```

---

## 🎯 Common Tasks

### Sync Styles from Exactly
```javascript
import { SYNC_EXACTLY_STYLES } from './graphql/operations';

const { data } = await client.mutate({
  mutation: SYNC_EXACTLY_STYLES
});
```

### Generate Images
```javascript
import { GENERATE_EXACTLY_IMAGES } from './graphql/operations';

const { data } = await client.mutate({
  mutation: GENERATE_EXACTLY_IMAGES,
  variables: {
    styleUuid: "abc-123",
    prompt: "A beautiful mountain landscape",
    params: JSON.stringify({ num_images: 4 })
  }
});
```

### Save to DAM
```javascript
import { SAVE_GENERATED_IMAGES_TO_DAM } from './graphql/operations';

const selection = urls.map((url, i) => ({
  remoteUrl: url,
  fileName: `generated-${i}.png`
}));

const { data } = await client.mutate({
  mutation: SAVE_GENERATED_IMAGES_TO_DAM,
  variables: {
    projectUuid: "project-456",
    folderPath: "/sites/digitall/files/generated",
    selection: selection
  }
});
```

---

## 📦 Module Info

| Property | Value |
|----------|-------|
| **Group ID** | org.jahia.se.modules |
| **Artifact ID** | exactlyImageGenerator |
| **Version** | 1.0.0-SNAPSHOT |
| **Type** | OSGi Bundle |
| **Jahia Version** | 8.2.0.0+ |

---

## 🔐 Security

- ✅ Token stored server-side only
- ✅ No browser access to Exactly API
- ✅ All downloads server-side
- ✅ Permission checks on DAM operations

---

## 📚 Documentation

- **README.md** - Full documentation
- **GRAPHQL_OPERATIONS.md** - GraphQL examples
- **IMPLEMENTATION_SUMMARY.md** - Technical details

---

## 🆘 Troubleshooting

### Module won't start
```bash
# Check logs
tail -f digital-factory-data/logs/jahia.log

# Check bundle
bundle:list | grep exactly
```

### API calls fail
- Verify token in config file
- Check network connectivity
- Enable debug logging

### GraphQL errors
- Test in GraphQL playground
- Check user authentication
- Verify mutation syntax

---

## 📞 Support

For detailed documentation, see:
- [README.md](./README.md)
- [GRAPHQL_OPERATIONS.md](./GRAPHQL_OPERATIONS.md)
- Exactly.ai API Docs: https://api.exactly.ai/public/docs/

---

**Built for Jahia DXP** | **Powered by Exactly.ai**
