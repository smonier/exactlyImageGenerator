/**
 * GraphQL operations for Exactly.ai Image Generator
 *
 * These can be used with Apollo Client in the React UI
 */

import {gql} from '@apollo/client';

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Sync styles from Exactly API
 */
export const SYNC_EXACTLY_STYLES = gql`
  mutation SyncExactlyStyles($siteKey: String!) {
    exactly {
      syncStyles(siteKey: $siteKey) {
        successful
        message
      }
    }
  }
`;

/**
 * Create a new style in Exactly.ai
 */
export const CREATE_EXACTLY_STYLE = gql`
  mutation CreateExactlyStyle($siteKey: String!, $name: String!, $description: String) {
    exactly {
      createStyle(siteKey: $siteKey, name: $name, description: $description) {
        successful
        message
      }
    }
  }
`;

/**
 * Delete a style from Exactly.ai
 */
export const DELETE_EXACTLY_STYLE = gql`
  mutation DeleteExactlyStyle($styleUuid: String!) {
    exactly {
      deleteStyle(styleUuid: $styleUuid) {
        successful
        message
      }
    }
  }
`;

/**
 * Upload training images to Exactly.ai
 */
export const UPLOAD_TRAINING_IMAGES = gql`
  mutation UploadTrainingImages($styleUuid: String!, $damAssetUuids: [String!]!) {
    exactly {
      uploadTrainingImages(styleUuid: $styleUuid, damAssetUuids: $damAssetUuids) {
        successful
        message
      }
    }
  }
`;

/**
 * Get training images from Exactly.ai for a style
 */
export const GET_TRAINING_IMAGES = gql`
  mutation GetTrainingImages($styleUuid: String!) {
    exactly {
      getTrainingImages(styleUuid: $styleUuid) {
        successful
        message
      }
    }
  }
`;

/**
 * Delete a training image from Exactly.ai
 */
export const DELETE_TRAINING_IMAGE = gql`
  mutation DeleteTrainingImage($styleUuid: String!, $imageUid: String!) {
    exactly {
      deleteTrainingImage(styleUuid: $styleUuid, imageUid: $imageUid) {
        successful
        message
      }
    }
  }
`;

/**
 * Train a style
 */
export const TRAIN_EXACTLY_STYLE = gql`
  mutation TrainExactlyStyle($styleUuid: String!) {
    exactly {
      trainStyle(styleUuid: $styleUuid) {
        successful
        message
      }
    }
  }
`;

/**
 * Get model details
 */
export const GET_MODEL = gql`
  mutation GetModel($styleUuid: String!) {
    exactly {
      getModel(styleUuid: $styleUuid) {
        successful
        message
      }
    }
  }
`;

/**
 * Get training progress
 */
export const GET_TRAINING_PROGRESS = gql`
  mutation GetTrainingProgress($styleUuid: String!) {
    exactly {
      getTrainingProgress(styleUuid: $styleUuid) {
        successful
        message
      }
    }
  }
`;

/**
 * Put model to draft state
 */
export const PUT_MODEL_TO_DRAFT = gql`
  mutation PutModelToDraft($styleUuid: String!) {
    exactly {
      putModelToDraft(styleUuid: $styleUuid) {
        successful
        message
      }
    }
  }
`;

/**
 * Cancel training
 */
export const CANCEL_TRAINING = gql`
  mutation CancelTraining($styleUuid: String!) {
    exactly {
      cancelTraining(styleUuid: $styleUuid) {
        successful
        message
      }
    }
  }
`;

/**
 * Generate images from prompt
 */
export const GENERATE_EXACTLY_IMAGES = gql`
  mutation GenerateExactlyImages($styleUuid: String!, $prompt: String!, $params: String) {
    exactly {
      generateImages(styleUuid: $styleUuid, prompt: $prompt, paramsJson: $params) {
        successful
        message
      }
    }
  }
`;

/**
 * Save generated images to DAM
 */
export const SAVE_GENERATED_IMAGES_TO_DAM = gql`
  mutation SaveGeneratedImagesToDam(
    $projectUuid: String!
    $folderPath: String
    $folderUuid: String
    $selectionJson: String!
  ) {
    exactly {
      saveGeneratedImagesToDam(
        projectNodeUuid: $projectUuid
        targetFolderPath: $folderPath
        targetFolderUuid: $folderUuid
        selectionJson: $selectionJson
      ) {
        successful
        message
      }
    }
  }
`;

// ============================================================================
// QUERIES (using Jahia's built-in GraphQL)
// ============================================================================

/**
 * Get all styles from JCR
 * Note: Path must be constructed client-side with siteKey
 */
export const GET_STYLES = gql`
  query GetStyles($path: String!) {
    jcr {
      nodeByPath(path: $path) {
        children(fieldFilter: {filters: [{fieldName: "primaryNodeType.name", value: "eximgynt:style"}]}) {
          nodes {
            uuid
            name
            displayName
            properties {
              name
              value
            }
          }
        }
      }
    }
  }
`;

/**
 * Get style by UUID
 */
export const GET_STYLE_BY_UUID = gql`
  query GetStyleByUuid($uuid: String!) {
    jcr {
      nodeById(uuid: $uuid) {
        uuid
        name
        displayName
        properties {
          name
          value
        }
      }
    }
  }
`;

/**
 * Get project by UUID
 */
export const GET_PROJECT_BY_UUID = gql`
  query GetProjectByUuid($uuid: String!) {
    jcr {
      nodeById(uuid: $uuid) {
        uuid
        name
        displayName
        properties {
          name
          value
        }
      }
    }
  }
`;

/**
 * Get all projects
 * Note: Path must be constructed client-side with siteKey
 */
export const GET_PROJECTS = gql`
  query GetProjects($path: String!) {
    jcr {
      nodeByPath(path: $path) {
        children(fieldFilter: {filters: [{fieldName: "primaryNodeType.name", value: "eximgynt:project"}]}) {
          nodes {
            uuid
            name
            displayName
            properties {
              name
              value
            }
          }
        }
      }
    }
  }
`;

// ============================================================================
// TYPE DEFINITIONS (JSDoc for TypeScript)
// ============================================================================

/**
 * @typedef {Object} GeneratedImageSelectionInput
 * @property {string} [remoteUrl]
 * @property {string} [remoteId]
 * @property {string} [fileName]
 * @property {string} [title]
 */

/**
 * @typedef {Object} ExactlyStyle
 * @property {string} uuid
 * @property {string} [exactlyId]
 * @property {string} [name]
 * @property {string} [status]
 * @property {string} [lastSynced]
 * @property {string} [metadataJson]
 */

/**
 * @typedef {Object} TrainStyleResult
 * @property {string} projectUuid
 * @property {string} [remoteJobId]
 * @property {string} status
 * @property {string} [message]
 */

/**
 * @typedef {Object} GenerateImagesResult
 * @property {string} projectUuid
 * @property {string} status
 * @property {string[]} [generatedRemoteUrls]
 * @property {string} [message]
 */

/**
 * @typedef {Object} DamAssetRef
 * @property {string} uuid
 * @property {string} path
 * @property {string} name
 */

/**
 * @typedef {Object} SaveToDamResult
 * @property {string} projectUuid
 * @property {DamAssetRef[]} assets
 * @property {string} [message]
 */
