package org.jahia.se.modules.exactlyImageGenerator.graphql;

import org.jahia.modules.graphql.provider.dxm.DXGraphQLExtensionsProvider;
import org.osgi.service.component.annotations.Component;

/**
 * GraphQL extension provider for Exactly.ai mutations
 * Marker component - no implementation required
 */
@Component(service = DXGraphQLExtensionsProvider.class, immediate = true)
public class ExactlyGraphQLExtension implements DXGraphQLExtensionsProvider {
    // Marker component; no implementation required.
}
