# Agent harness: exactlyImageGenerator

Generic Jahia knowledge (OSGi, GraphQL security, Moonstone, build) lives in
[AIStartupKit](https://github.com/smonier/AIStartupKit): read its `CLAUDE.md` first, then the
`jahia-osgi-ui-extension`, `jahia-java-security` and `jahia-java-jcr` skills.

## This project

- OSGi bundle + jContent app (`targets: ['jcontent:95']`), React 18, Moonstone ~2.20.3 (the version of
  jContent 3.7.1/3.8.0; keep the pin on the host's minor).
- Authorization lives in `services/ExactlyAccessService`; every new GraphQL field goes through
  `ExactlyOperations.run` and resolves its node with `access.require*`. Never add a system session.
- Generated image URLs are only trusted through `GeneratedImageRegistry`; never accept a URL from
  the browser.
- Build with Maven 3.8: `mvn clean install`.

## Testing without an Exactly.ai account

Point `exactly.api.baseUrl` at a local stand-in of the API (`http://host.docker.internal:<port>`,
token of your choice) to exercise sync, training, progress and generation; image downloads stay
`https` only, so return real `https` image URLs (picsum.photos works). Restore the configuration
afterwards. Test permissions with users granted through GraphQL `grantRoles` (a Groovy
`grantRoles` from a system session does not give `jContentAccess`).
