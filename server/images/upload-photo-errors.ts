/**
 * Stable **`code`** values returned in JSON from `POST /uploadPhoto` (and related SmugMug upload paths).
 * Search the codebase for the constant name or string literal to find server handling and hints.
 */

/** `ThaliaImageUploader.uploadNotReadyReason` — missing `config/secrets.js` export, consumer keys, OAuth access token, or album URI. */
export const THALIA_SMUG_NOT_CONFIGURED = 'THALIA_SMUG_NOT_CONFIGURED'

/** Multipart upload failed after the body was accepted (SmugMug API, DB insert, etc.). See `upload_photo_form` logs. */
export const THALIA_SMUG_MULTIPART_FAILED = 'THALIA_SMUG_MULTIPART_FAILED'

/** JSON upload: bad client input (400). See `upload_photo_json` logs. */
export const THALIA_SMUG_JSON_CLIENT_ERROR = 'THALIA_SMUG_JSON_CLIENT_ERROR'

/** JSON upload: upstream / SmugMug failure (502). See `upload_photo_json` logs. */
export const THALIA_SMUG_JSON_SERVER_ERROR = 'THALIA_SMUG_JSON_SERVER_ERROR'
