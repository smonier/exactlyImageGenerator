# Exactly.ai Image Generator for Jahia

A jContent app that lets editors train [Exactly.ai](https://exactly.ai) styles on images of a site's
media library, generate images in those styles, and save the ones they keep back into the media
library.

- **Module type:** OSGi bundle (Maven) with a React 18 jContent UI extension (webpack, Module
  Federation, `@jahia/moonstone` 2.20).
- **Jahia:** 8.2 (jContent 3.7 or later).
- **Where:** jContent, *Additional* accordion, *Exactly.ai Image Generator*, on sites that enable
  the module.

## Using it

The app has three steps, shown as tabs in its header:

1. **Style.** The styles of the site, synchronized from the models of the Exactly.ai account
   (*Sync from Exactly.ai*; the app also syncs once when it opens). Create a style with *New
   style*, delete one with the bin (the model is deleted on Exactly.ai too). *Select* opens the
   next step.
2. **Training.** The training images already on Exactly.ai, and *Pick images* to choose images of
   the site's media library and send them. Exactly.ai asks for at least 10 images, 1024 px or more
   on their shortest side. *Start training* runs the training; the page follows its progress and
   unlocks the third step when the style is ready. *Back to draft* reopens a trained style.
3. **Generation.** A prompt, the number of images (1 to 4), the aspect ratio, and optional
   reference images from the media library (2.5 MB at most each). Select the results to keep, choose
   a folder of the site's media library (default `files/exactly-generated`) and save. Saved images
   are not published: publish them with the page that uses them.

Styles are stored as `eximgynt:style` nodes in `/sites/<site>/contents/exactly-styles`.

## Configuration

`org.jahia.se.modules.exactlyImageGenerator.cfg` (shipped with an empty token, never overwritten
on redeploy):

| Key | Value |
|---|---|
| `exactly.api.token` | API token of the Exactly.ai account (required) |
| `exactly.api.baseUrl` | `https://api.exactly.ai` |
| `exactly.api.path` | `public` |
| `exactly.api.version` | `v1` |

All four are required; until they are set, the app shows a warning and no call leaves Jahia.
Changes are picked up without a restart. One token serves every site of the server.

## Security model

- Every GraphQL field resolves its site or style with the **caller's own session** and checks:
  the site exists and has the module enabled, the caller holds `jContentAccess` on it, and, for
  anything that changes data on Exactly.ai or in the JCR, `jcr:write_default` on the site and on
  the style. A refusal is the GraphQL error `Permission denied`, the same for a missing node and a
  missing right. A style is pinned to its type and to its site's styles folder.
- In practice: an editor can do everything, a reviewer can look but not train, generate or save.
- Training images are read with the caller's session and only from the site's own `files`; generated
  images are saved with the caller's session, only into a folder of the site's `files`.
- *Save* names a generation and image indices, never a URL: the server only downloads URLs that
  Exactly.ai returned to it for that user's generation (kept in memory for 6 hours, per cluster
  node). Downloads are `https` only, capped at 25 MB, and must be PNG, JPEG or WebP.
- The token is sent only to the configured API host, redirects included. Every call has connect
  and read timeouts.
- Identifiers that go into Exactly.ai URLs are validated; generation options are limited to
  `num_images`, `size` and `reference_images`.
- The API token is never logged or returned; prompts and API error bodies are logged at DEBUG only.

## GraphQL API

All answers are `{successful, message}`; `message` carries JSON where noted.

| Field | Arguments | Needs | Answer |
|---|---|---|---|
| `Query.exactly.configured` | `siteKey` | access | `true` when the API is configured |
| `Query.exactly.trainingImages` | `styleUuid` | access | JSON array of `{id, url, width, height}` |
| `Query.exactly.trainingProgress` | `styleUuid` | access | JSON `{status, progress}` |
| `Query.exactly.model` | `styleUuid` | access | JSON `{id, name, status}` |
| `Mutation.exactly.syncStyles` | `siteKey` | write | count of synced styles |
| `Mutation.exactly.createStyle` | `siteKey`, `name`, `description` | write | uuid of the style node |
| `Mutation.exactly.deleteStyle` | `styleUuid` | write | |
| `Mutation.exactly.uploadTrainingImages` | `styleUuid`, `damAssetUuids` (1 to 50) | write | `Uploaded n/m images` |
| `Mutation.exactly.deleteTrainingImage` | `styleUuid`, `imageUid` | write | |
| `Mutation.exactly.trainStyle` | `styleUuid` | write | JSON `{jobId, status}` |
| `Mutation.exactly.putModelToDraft` | `styleUuid` | write | JSON `{status}` |
| `Mutation.exactly.cancelTraining` | `styleUuid` | write | JSON `{status}` |
| `Mutation.exactly.generateImages` | `styleUuid`, `prompt` (2000 chars max), `paramsJson` | write | JSON `{generationId, status, urls}` |
| `Mutation.exactly.saveGeneratedImages` | `generationId`, `indices`, `targetFolderPath`, `title` | write | JSON `{saved, requested, folderPath}` |

## Build and deploy

Requires JDK 17, **Maven 3.8** (3.9 writes a wrong `Import-Package` for Jahia modules) and network
access to `devtools.jahia.com` and `archives-devtools.jahia.com`. The build installs Node 22 and
Yarn itself.

```bash
mvn clean install
```

Deploy `target/exactlyImageGenerator-<version>.jar` with the provisioning API or the module
manager, then enable the module on a site and set the token.

## Known limitations

- No automated tests yet (Cypress specs for every refusal and success path are the next step).
- No CI build or release workflow; releases have been built locally.
- `eximgynt:style` and `eximgynt:project` are editorial, visible types: editors can edit style
  nodes in jContent and desynchronize them. `eximgynt:project` is unused. Hiding or removing them is
  a CND change on a deployed type (see AIStartupKit `jahia-dev-change-cnd`).
- Messages coming from the server (Exactly.ai errors, upload counts) are in English.
- Generations are remembered in memory: after 6 hours, a restart or on another cluster node, generate
  again before saving.
