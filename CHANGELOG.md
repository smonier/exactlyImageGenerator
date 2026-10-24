# Changelog

## 1.1.0 (2026-10-24)

### Security

- Every `exactly` GraphQL field checks the caller: site with the module enabled, `jContentAccess`,
  and `jcr:write_default` for anything that changes data. All JCR reads and writes use the caller's
  session; no system session is left.
- Training images are read with the caller's session (only images the caller can read, 20 MB at
  most), and generated images can only be saved into the style's site media library.
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
- A style in training shows its progress in the styles table, and the list resyncs when it ends.
- Training images can come from any media library the user can read (another site, shared media);
  a refused file is named with the reason (not an image, larger than 20 MB, Exactly's message).
- Images under 1024 px on their shortest side are refused before anything is sent, all of them named
  with their size in one message.
- Saved images are named after the title typed in the Generation step (or the prompt), `-2`, `-3`
  for several, instead of `exactly-<id>-<n>`.
- Build: Node 22, Jahia archive repositories, `target/` no longer tracked; dead code, unused
  dependencies and obsolete documents removed; French labels for the content types.
