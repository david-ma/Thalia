# Thalia image upload

Framework module: `server/images/`. Sites import **`ThaliaImageUploader`** from `thalia/controllers`.

## Quick start

```ts
import { ThaliaImageUploader } from 'thalia/controllers'

const imageUploader = new ThaliaImageUploader({
  adapter: 'local-disk', // 'smugmug' | 'uploadthing' | 'local-disk'
  persistToDatabase: false, // optional; default true (MySQL `images` row)
  localDisk: {
    basePath: path.join(siteRoot, 'public', 'uploads'),
    baseUrl: '/uploads',
  },
  // uploadThingSecret: '…', // required when adapter is 'uploadthing'
})

// config.controllers.uploadImage = imageUploader.controller.bind(imageUploader)
```

Declare **`adapter` in `config.ts`**. Thalia does **not** auto-select a tier from `UPLOADTHING_SECRET` or `SMUGMUG_*` in the environment (you may read env in config and pass values into the constructor).

## Routes

| Route | Typical site |
|-------|----------------|
| `/uploadImage` | General default (example-src) |
| `/uploadPhoto` | example-auth / SmugMug-era demos |

Multipart field name: **`fileToUpload`**.

## Adapters

| Adapter | Constructor | DB rows |
|---------|-------------|---------|
| **local-disk** | `adapter: 'local-disk'`, `localDisk: { basePath, baseUrl }` | When `persistToDatabase !== false` |
| **uploadthing** | `adapter: 'uploadthing'`, `uploadThingSecret` | Yes (stores CDN URL) |
| **smugmug** | `adapter: 'smugmug'`, secrets in `config/secrets.js` | Yes (full metadata) |

## Developer-owned image tracking

Thalia’s job ends at **store bytes → return serve URL** (and optionally one **`images`** row). It does **not** decide:

- Which user owns an upload
- Gallery ordering, albums, or moderation
- Whether to show uploads on a profile page

**You** choose persistence:

- **No index** — `persistToDatabase: false`; return URL to the client only (`websites/example-src` demo).
- **Framework `images` table** — register schemas + machine in `config.database` (`websites/example-auth`).
- **Custom tables** — insert your own row in a controller after `adapter.store()`.
- **Client-only list** — e.g. `localStorage` on the demo page (not for production catalogues).

See `websites/example-src/src/docs/image-upload.md` (served at `/docs/image-upload` on example-src).

## Tests

- Unit: `bun test tests/Unit/image-adapter-selection.test.ts`
- example-src (no DB): `bun test tests/Integration/example-src-image-upload.test.ts`
- example-auth local-disk + MySQL: `SKIP_DATABASE_TESTS=0 bun test tests/Integration/example-auth-local-disk.test.ts`

Integration tests may set `THALIA_IMAGE_ADAPTER` and `THALIA_LOCAL_DISK_*` at runtime (applied in `init()`, not only at config import).
