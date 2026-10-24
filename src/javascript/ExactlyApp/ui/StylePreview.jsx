import React from 'react';
import {useQuery} from '@apollo/client';
import {Image, Thumbnail} from '@jahia/moonstone';
import {PREVIEW} from '../graphql';
import {isHttpsUrl} from '../media';

/**
 * First training image of a style, so the list shows what each style looks like. Fetched once per
 * session (Apollo cache); a style without training images, or one Exactly cannot answer for, shows an icon.
 */
export const StylePreview = ({styleUuid, name}) => {
    const {data} = useQuery(PREVIEW, {variables: {styleUuid}, fetchPolicy: 'cache-first', errorPolicy: 'all'});
    const url = data?.exactly?.preview?.successful ? data.exactly.preview.message : '';
    if (!isHttpsUrl(url)) {
        return <Thumbnail variant="icon" src={<Image/>} alt=""/>;
    }
    return <Thumbnail variant="preview" src={url} alt={name} imgProps={{loading: 'lazy'}}/>;
};
