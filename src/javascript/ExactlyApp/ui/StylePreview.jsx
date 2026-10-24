import React from 'react';
import {useQuery} from '@apollo/client';
import {Image, Thumbnail} from '@jahia/moonstone';
import {PREVIEW} from '../graphql';
import {isHttpsUrl} from '../media';

const THUMBNAIL_PREFIX = 'data:image/jpeg;base64,';

/**
 * What a style looks like: the thumbnail cached on the style node (made at sync, no call to Exactly),
 * else its first training image asked once per session. A style without training images shows an icon.
 */
export const StylePreview = ({styleUuid, name, thumbnail}) => {
    const cached = typeof thumbnail === 'string' && thumbnail.startsWith(THUMBNAIL_PREFIX);
    const {data} = useQuery(PREVIEW, {variables: {styleUuid}, fetchPolicy: 'cache-first', errorPolicy: 'all', skip: cached});
    if (cached) {
        return <Thumbnail variant="preview" src={thumbnail} alt={name}/>;
    }
    const url = data?.exactly?.preview?.successful ? data.exactly.preview.message : '';
    if (!isHttpsUrl(url)) {
        return <Thumbnail variant="icon" src={<Image/>} alt=""/>;
    }
    return <Thumbnail variant="preview" src={url} alt={name} imgProps={{loading: 'lazy'}}/>;
};
