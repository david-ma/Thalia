/**
 * Maps SmugMug upload ack + AlbumImage API payload into Drizzle `images` insert values.
 */

import type { NewImage } from '../../models/smugmug.js'

/** Subset of upload.smugmug.com JSON used when persisting AlbumImage metadata. */
export type SmugMugUploadAck = {
  stat?: string
  method?: string
  Image: {
    StatusImageReplaceUri?: string
    ImageUri: string
    AlbumImageUri?: string
    URL: string
  }
  Asset?: { AssetComponentUri?: string; AssetUri?: string }
}

function nullableNumberField(v: unknown): number | null {
  return typeof v === 'number' ? v : v != null ? Number(v) : null
}

/**
 * Build row values for `insert(images).values(…)` from upload ack + verbosity AlbumImage.
 * @throws If `AlbumImage.ImageKey` is missing or not a string.
 */
export function buildSmugMugNewImageInsert(data: SmugMugUploadAck, ai: Record<string, unknown> | undefined): NewImage {
  const imageKey = ai?.ImageKey
  if (typeof imageKey !== 'string' || !imageKey) {
    throw new Error('SmugMug response missing AlbumImage.ImageKey')
  }

  return {
    albumKey: typeof ai.AlbumKey === 'string' ? ai.AlbumKey : '',
    caption: typeof ai.Caption === 'string' ? ai.Caption : '',
    filename: typeof ai.FileName === 'string' ? ai.FileName : '',
    url: data.Image.URL,
    originalSize: nullableNumberField(ai.OriginalSize),
    originalWidth: nullableNumberField(ai.OriginalWidth),
    originalHeight: nullableNumberField(ai.OriginalHeight),
    thumbnailUrl: typeof ai.ThumbnailUrl === 'string' ? ai.ThumbnailUrl : '',
    archivedUri: typeof ai.ArchivedUri === 'string' ? ai.ArchivedUri : '',
    archivedSize: nullableNumberField(ai.ArchivedSize),
    archivedMD5: typeof ai.ArchivedMD5 === 'string' ? ai.ArchivedMD5 : '',
    imageKey,
    preferredDisplayFileExtension:
      typeof ai.PreferredDisplayFileExtension === 'string' ? ai.PreferredDisplayFileExtension : '',
    uri: typeof ai.Uri === 'string' && ai.Uri ? ai.Uri : data.Image.ImageUri,
    adapterName: 'smugmug',
  }
}
