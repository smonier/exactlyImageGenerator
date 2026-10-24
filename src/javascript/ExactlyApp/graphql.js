import {gql} from '@apollo/client';

const RESPONSE = 'successful message';

export const CONFIGURED = gql`
    query ExactlyConfigured($siteKey: String!) {
        exactly { configured(siteKey: $siteKey) }
    }
`;

export const STYLES = gql`
    query ExactlyStyles($path: String!) {
        jcr(workspace: EDIT) {
            nodeByPath(path: $path) {
                uuid
                workspace
                children(typesFilter: {types: ["eximgynt:style"]}) {
                    nodes {
                        uuid
                        workspace
                        name
                        styleName: property(name: "eximg:name") { value }
                        exactlyId: property(name: "eximg:exactlyId") { value }
                        status: property(name: "eximg:status") { value }
                        description: property(name: "eximg:description") { value }
                        lastSynced: property(name: "eximg:lastSynced") { value }
                    }
                }
            }
        }
    }
`;

export const MODEL = gql`
    query ExactlyModel($styleUuid: String!) {
        exactly { model(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const TRAINING_PROGRESS = gql`
    query ExactlyTrainingProgress($styleUuid: String!) {
        exactly { trainingProgress(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const PREVIEW = gql`
    query ExactlyPreview($styleUuid: String!) {
        exactly { preview(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const TRAINING_IMAGES = gql`
    query ExactlyTrainingImages($styleUuid: String!) {
        exactly { trainingImages(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const SYNC_STYLES = gql`
    mutation ExactlySyncStyles($siteKey: String!) {
        exactly { syncStyles(siteKey: $siteKey) { ${RESPONSE} } }
    }
`;

export const CREATE_STYLE = gql`
    mutation ExactlyCreateStyle($siteKey: String!, $name: String!, $description: String) {
        exactly { createStyle(siteKey: $siteKey, name: $name, description: $description) { ${RESPONSE} } }
    }
`;

export const DELETE_STYLE = gql`
    mutation ExactlyDeleteStyle($styleUuid: String!) {
        exactly { deleteStyle(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const UPLOAD_TRAINING_IMAGES = gql`
    mutation ExactlyUploadTrainingImages($styleUuid: String!, $damAssetUuids: [String]!) {
        exactly { uploadTrainingImages(styleUuid: $styleUuid, damAssetUuids: $damAssetUuids) { ${RESPONSE} } }
    }
`;

export const DELETE_TRAINING_IMAGE = gql`
    mutation ExactlyDeleteTrainingImage($styleUuid: String!, $imageUid: String!) {
        exactly { deleteTrainingImage(styleUuid: $styleUuid, imageUid: $imageUid) { ${RESPONSE} } }
    }
`;

export const TRAIN_STYLE = gql`
    mutation ExactlyTrainStyle($styleUuid: String!) {
        exactly { trainStyle(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const PUT_MODEL_TO_DRAFT = gql`
    mutation ExactlyPutModelToDraft($styleUuid: String!) {
        exactly { putModelToDraft(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const CANCEL_TRAINING = gql`
    mutation ExactlyCancelTraining($styleUuid: String!) {
        exactly { cancelTraining(styleUuid: $styleUuid) { ${RESPONSE} } }
    }
`;

export const GENERATE_IMAGES = gql`
    mutation ExactlyGenerateImages($styleUuid: String!, $prompt: String!, $paramsJson: String) {
        exactly { generateImages(styleUuid: $styleUuid, prompt: $prompt, paramsJson: $paramsJson) { ${RESPONSE} } }
    }
`;

export const SAVE_GENERATED_IMAGES = gql`
    mutation ExactlySaveGeneratedImages($generationId: String!, $indices: [Int]!, $targetFolderPath: String, $title: String) {
        exactly {
            saveGeneratedImages(generationId: $generationId, indices: $indices, targetFolderPath: $targetFolderPath, title: $title) { ${RESPONSE} }
        }
    }
`;

/**
 * Reads an `{successful, message}` answer. Throws with the server's message when the call failed, and
 * parses `message` as JSON when asked.
 */
export const readAnswer = (answer, {json = false} = {}) => {
    if (!answer?.successful) {
        throw new Error(answer?.message || 'Unknown error');
    }
    if (!json) {
        return answer.message;
    }
    try {
        return JSON.parse(answer.message);
    } catch {
        throw new Error('Unexpected answer from the server');
    }
};

/** Message of an Apollo error or of an error thrown by readAnswer. */
export const errorMessage = error => error?.graphQLErrors?.[0]?.message || error?.message || String(error);
