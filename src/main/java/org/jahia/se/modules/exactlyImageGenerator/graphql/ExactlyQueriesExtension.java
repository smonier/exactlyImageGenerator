package org.jahia.se.modules.exactlyImageGenerator.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;

/**
 * Adds {@code exactly} to the root query type.
 */
@GraphQLTypeExtension(DXGraphQLProvider.Query.class)
public final class ExactlyQueriesExtension {

    private ExactlyQueriesExtension() {
        // utility
    }

    @GraphQLField
    @GraphQLName("exactly")
    @GraphQLDescription("Exactly.ai related queries")
    public static ExactlyQueries exactly() {
        return new ExactlyQueries();
    }
}
