/**
 * ImageStoreAdapter — the contract every image-storage backend must fulfil.
 *
 * Three concrete adapters are planned (see server/images/index.ts task list):
 *   - SmugMugAdapter      — full SmugMug OAuth upload; richest metadata.
 *   - UploadThingUrlAdapter — no SmugMug; persists the UploadThing URL directly.
 *   - LocalDiskAdapter    — no external keys; writes to /data/photos/<md5>.<ext>.
 *
 * ThaliaImageUploader.init() selects the best available adapter automatically.
 */

/**
 * Caller-supplied metadata about the image being stored.
 * All fields except `filename` and `mimeType` are optional.
 */
export type ImageMeta = {
  filename: string
  mimeType: string
  caption?: string
  title?: string
  keywords?: string
}

/**
 * Minimal representation of a successfully stored image.
 *
 * Fields map to the `images` Drizzle table columns; SmugMug-specific fields are
 * optional so UploadThing and LocalDisk adapters can return the same type with
 * those fields absent.
 *
 * NOTE: once the `adapterName` column migration lands (migration 0003), every
 * StoredImage returned from a concrete adapter should include `adapterName`.
 */
export type StoredImage = {
  /** Canonical URL for serving the image (always present). */
  url: string
  /** Smaller preview URL — present for SmugMug; may be absent for other adapters. */
  thumbnailUrl?: string | null
  /** Hex MD5 of the original bytes — used for deduplication. */
  md5?: string | null
  filename: string
  /** MIME type of the stored file. */
  mimeType?: string | null
  originalWidth?: number | null
  originalHeight?: number | null
  originalSize?: number | null
  /** Identifies which adapter persisted this image (populated once migration 0003 lands). */
  adapterName?: string
  /** SmugMug image key — absent for non-SmugMug adapters. */
  imageKey?: string | null
  /** SmugMug album key — absent for non-SmugMug adapters. */
  albumKey?: string | null
}

/**
 * Contract every image-storage backend must fulfil.
 *
 * Implementations are responsible for both the remote/local upload AND
 * persisting the resulting metadata to the Thalia DB if a db context is
 * available.
 */
export interface ImageStoreAdapter {
  /** Short identifier used in logs and (future) `adapterName` DB column. */
  readonly name: string

  /**
   * Store image bytes and return a `StoredImage` with the canonical serve URL.
   * Implementations should:
   *   1. Upload / write the bytes to their backing store.
   *   2. Persist a row to the `images` table.
   *   3. Return the persisted row as a `StoredImage`.
   */
  store(bytes: Buffer, meta: ImageMeta): Promise<StoredImage>

  /**
   * Return an already-stored image matching `md5`, or `null` if not found.
   * Used for MD5-based deduplication before uploading.
   * Optional — adapters that do not support deduplication may omit this.
   */
  findByMd5?(md5: string): Promise<StoredImage | null>
}
