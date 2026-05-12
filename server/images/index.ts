/**
 * Thalia image upload subsystem — lives at server/images/ (renamed from server/smugmug/).
 *
 * ─── WHAT IT DOES TODAY ────────────────────────────────────────────────────────
 * Accepts a user photo (multipart form or UploadThing-style JSON body), fetches or
 * reads the bytes, deduplicates against the DB by MD5, then pushes the image to
 * SmugMug via OAuth 1.0a multipart upload. SmugMug resizes the image and returns
 * metadata (image key, album key, thumbnail URL, archived URL, dimensions, etc.)
 * which Thalia stores in the `images` table for future serving.
 *
 * ─── TARGET GOLDEN PATHS ──────────────────────────────────────────────────────
 * The controller should support three tiers, selected automatically by what is
 * configured, with no 503 when a higher-priority adapter is absent:
 *
 *   1. SmugMug  — webmaster has SMUGMUG_* keys → upload to SmugMug, save all
 *                 metadata (sizes, thumbnail URL, image key …) to DB. (current)
 *   2. UploadThing only — no SmugMug keys → persist the UploadThing URL directly
 *                 in the DB, serve that URL on future pages.
 *   3. Local disk — no external keys → write bytes to /data/photos/<md5>.<ext>,
 *                 store the local path/URL in the DB.
 *
 * ─── REFACTOR PLAN ─────────────────────────────────────────────────────────────
 *  [x] Rename server/smugmug/ → server/images/  (this file → server/images/index.ts)
 *  [x] Rename SmugMugUploader → ThaliaImageUploader
 *  [x] Extract ImageStoreAdapter interface + StoredImage type (server/images/adapters.ts)
 *  [x] Write failing tests for adapter selection + generalized image model
 *      (tests/Unit/image-adapter-selection.test.ts) — 5 pass (interface), 7 fail (not yet impl)
 *  [x] Migrate DB: add adapterName column (varchar, nullable) to `images` table;
 *      make imageKey nullable (non-SmugMug adapters have no key); write migration
 *      0003_image_adapter_name + update models/smugmug.ts accordingly
 *  [x] Implement SmugMugAdapter, UploadThingUrlAdapter, LocalDiskAdapter
 *      (LocalDisk: write to /data/photos/<md5>.<ext>, store local URL in DB)
 *  [x] ThaliaImageUploader.init() probes config and picks the best available adapter;
 *      no more 503 when SmugMug is unconfigured — always falls back to next tier
 *  [x] ThaliaImageUploader exposes adminController() — optional, read-only controller
 *      listing images + adapter status; gated by website.devMode or a specified role;
 *      no CrudFactory wiring required from webmaster (zero-config admin surface)
 *  [x] Move smugmug-specific files into server/images/smugmug/ subfolder, strip the
 *      "smugmug-" prefix from filenames (smugmug-oauth.ts → smugmug/oauth.ts, etc.)
 *      Rename models/smugmug.ts → models/images.ts at the same time.
 *  [x] Merge multipart-upload-response.ts + verbosity-response.ts → smugmug/response-parsers.ts
 *  [x] Move mysql-insert-result.ts to models/util.ts (not image-specific)
 *  [x] Move https-request.ts to server/util/ (no SmugMug logic; useful everywhere)
 *  [x] Generalise log.ts service field from hardcoded 'smugmug' to the adapter name
 *
 * ─── BUGS ──────────────────────────────────────────────────────────────────────
 *  [x] oauthCallback() was passing Date.now() (milliseconds) as oauth_timestamp. Fixed:
 *      Math.floor(Date.now() / 1000) (seconds).
 *  [x] uploadImageToSmugmug() called fs.readFileSync() blocking the event loop. Fixed:
 *      await fsp.readFile().
 *  [x] init() used void import(secretsPath) — early requests saw a false "not configured"
 *      503 while secrets were still loading. Fixed: initPromise stored; controller() and
 *      oauthCallback() gate behind void this.initPromise.then(() => { … }).
 *
 * ─── MINOR OPTIMISATIONS ───────────────────────────────────────────────────────
 *  [x] oauthCallback() reimplements OAuth token exchange with raw https.request —
 *      consolidate into SmugMugClient so there is one OAuth path to maintain.
 *  [x] smugmugExpandParams() sorts keys deterministically; values with raw `&`/`=` remain
 *      unsupported (documented on the function) — full RFC-normalised encoding would change
 *      the golden OAuth signature fixture.
 *  [x] SmugMugClient.createMultipartFormData() (disk-based) calls fs.readFileSync —
 *      make async or delete (currently unused in the live flow).
 *  [x] pickRemoteFileUrl() could also accept 'imageUrl' and 'appUrl' field names to
 *      cover more upload-client conventions.
 *  [x] constants.ts (2 lines) can fold into https-request.ts or the main client file.
 */

export type { ImageMeta, ImageStoreAdapter, StoredImage } from './adapters.js'
export { SmugMugAdapter } from './smugmug/adapter.js'
export { UploadThingUrlAdapter } from './uploadthing-url-adapter.js'
export { LocalDiskAdapter } from './local-disk-adapter.js'
export { requestHttpsUtf8 } from '../util/https-request.js'
export type { HttpsUtf8Response, RequestHttpsUtf8Params, SmugMugHttpsLogContext } from '../util/https-request.js'
export { redactLogText, smugmugLogLine } from './log.js'
export type { SmugmugLogEvent, SmugmugLogLevel, ImageLogService } from './log.js'
export {
  assertSafeHttpsImageFetchUrl,
  fetchRemoteHttpsImageBytes,
  pickRemoteFileUrl,
} from './remote-image-fetch.js'
export { parseSmugMugVerbosityAlbumImage, parseSmugMugMultipartUploadResponse } from './smugmug/response-parsers.js'
export { SMUGMUG_REMOTE_FETCH_TIMEOUT_MS, SMUGMUG_HTTPS_TIMEOUT_MS } from '../util/https-request.js'
export { normalizeSmugMugAlbumUri } from './smugmug/album-uri.js'
export type { SmugMugUploadAck } from './smugmug/save-image-map.js'
export { buildSmugMugNewImageInsert } from './smugmug/save-image-map.js'
export type { SmugMugTokenSet } from './smugmug/client.js'
export { SmugMugClient } from './smugmug/client.js'
export {
  smugmugB64HmacSha1,
  smugmugBundleAuthorization,
  smugmugExpandParams,
  smugmugOauthEscape,
  smugmugSortParams,
} from './smugmug/oauth.js'
