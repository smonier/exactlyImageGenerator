package org.jahia.se.modules.exactlyImageGenerator.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;

public interface ExactlySyncResponse {
    
    @GraphQLField
    @GraphQLDescription("Status of the sync operation")
    boolean isSuccessful();
    
    @GraphQLField
    @GraphQLDescription("Message describing the result")
    String getMessage();
}
