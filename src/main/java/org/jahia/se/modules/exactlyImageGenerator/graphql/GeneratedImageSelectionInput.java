package org.jahia.se.modules.exactlyImageGenerator.graphql;

import graphql.annotations.annotationTypes.GraphQLDescription;
import graphql.annotations.annotationTypes.GraphQLField;
import graphql.annotations.annotationTypes.GraphQLName;

/**
 * Input type for generated image selection
 */
@GraphQLName("GeneratedImageSelectionInput")
@GraphQLDescription("Input for selecting a generated image to save to DAM")
public class GeneratedImageSelectionInput {
    
    @GraphQLField
    @GraphQLDescription("The remote URL of the generated image")
    public String remoteUrl;
    
    @GraphQLField
    @GraphQLDescription("The desired file name for the image")
    public String fileName;
    
    @GraphQLField
    @GraphQLDescription("Optional title/description for the image")
    public String title;
}
