/**
 * Apollo Client Configuration for Exactly.ai Image Generator
 *
 * Creates an Apollo Client configured for Jahia's GraphQL endpoint
 */

import {ApolloClient, InMemoryCache, createHttpLink} from '@apollo/client';
import {setContext} from '@apollo/client/link/context';

/**
 * Create Apollo Client for Jahia GraphQL
 * Uses Jahia's standard GraphQL endpoint at /modules/graphql
 */
export const createApolloClient = () => {
    // HTTP link to Jahia GraphQL endpoint
    const httpLink = createHttpLink({
        uri: `${window.contextJsParameters.contextPath}/modules/graphql`,
        credentials: 'same-origin'
    });

    // Auth link to include  CSRF token if needed
    const authLink = setContext((_, {headers}) => {
        return {
            headers: {
                ...headers,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        };
    });

    // Create and return client
    return new ApolloClient({
        link: authLink.concat(httpLink),
        cache: new InMemoryCache(),
        defaultOptions: {
            watchQuery: {
                fetchPolicy: 'network-only',
                errorPolicy: 'all'
            },
            query: {
                fetchPolicy: 'network-only',
                errorPolicy: 'all'
            },
            mutate: {
                errorPolicy: 'all'
            }
        }
    });
};
