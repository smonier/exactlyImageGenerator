package org.jahia.se.modules.exactlyImageGenerator.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;
import graphql.annotations.annotationTypes.GraphQLTypeExtension;
import org.jahia.modules.graphql.provider.dxm.DXGraphQLProvider;

/**
 * GraphQL extension to add exactly mutations to the root mutation type
 */
@GraphQLTypeExtension(DXGraphQLProvider.Mutation.class)
public final class ExactlyMutationsExtension {

    private ExactlyMutationsExtension() {
        // utility
    }

    @GraphQLField
    @GraphQLName("exactly")
    @GraphQLDescription("Exactly.ai related mutations")
    public static ExactlyMutations exactly() {
        return new ExactlyMutations();
    }
}
