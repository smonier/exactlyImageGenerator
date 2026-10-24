# Changelog

## 1.1.0 (unreleased)

### Security

- Every `exactly` GraphQL field checks the caller: site with the module enabled, `jContentAccess`,
  and `jcr:write_default` for anything that changes data. All JCR reads and writes use the caller's
  session; no system session is left.
- Training images can only come from the site's own media library, and generated images can only be
  saved into it.
- Saving generated images no longer takes URLs from the browser: the server downloads only the URLs
  Exactly.ai returned for that user's generation (https, 25 MB, PNG/JPEG/WebP).
- The API token is sent only to the configured API host, redirects included; HTTP calls have
  timeouts and one pooled client.
- Identifiers in Exactly.ai URLs are validated; generation options are limited to `num_images`,
  `size` and `reference_images` (the model can no longer be overridden).
- Removing the token from the configuration now disables the module at once.

### Changed

- New jContent UI on Moonstone 2.20 and React 18 (was React 17 + Material UI 4): header tabs for the
  three steps, a styles table, Moonstone modals, and the Generation step unlocks as soon as training
  completes. Thumbnails and fetches respect the context path. EN and FR.
- Reads (`trainingImages`, `trainingProgress`, `model`, `configured`) moved to `Query.exactly`;
  `saveGeneratedImagesToDam` is replaced by `saveGeneratedImages(generationId, indices, ...)`.
- Style sync matches styles by Exactly id within the site, keeps going when one model fails, maps
  statuses the CND does not know, and removes styles whose model is no longer on the account.
- Deleting a style whose model is already gone from Exactly.ai removes the style instead of failing.
- Each style row has a *Training images* button that opens its training images, ready styles included.
- Build: Node 22, Jahia archive repositories, `target/` no longer tracked; dead code, unused
  dependencies and obsolete documents removed; French labels for the content types.
