# Image upload — who tracks what?

This page documents the **example-src** upload demo. It is aimed at web developers (and agents) wiring Thalia image upload into a real site.

## What Thalia does

`POST /uploadImage` accepts multipart form field **`fileToUpload`** (or JSON with a remote URL for UploadThing-style flows). The active **adapter** stores bytes and returns JSON, for example:

```json
{
  "url": "/uploads/abc123….png",
  "filename": "photo.png",
  "md5": "…",
  "adapterName": "local-disk"
}
```

On **example-src**, the machine is configured as:

- `adapter: 'local-disk'`
- `persistToDatabase: false` — files go to `data/uploads/` (HTTP path `/uploads/…`); **no row** in an `images` table

Thalia does **not** maintain a site-wide gallery, search index, or user-owned album list unless **you** add that.

## What you might track (developer’s choice)

| Approach | When to use |
|----------|-------------|
| **Nothing** | One-off uploads; user only needs the returned URL |
| **Browser `localStorage`** | Demos / personal tools (see `/image-upload` on example-src) |
| **`images` table (Drizzle)** | Admin lists, dedupe across users, SmugMug metadata — see **example-auth** |
| **Your own table** | Link uploads to `user_id`, posts, products, etc. |
| **External CMS** | SmugMug / UploadThing URL as canonical store |

## example-src localStorage demo

The page at **`/image-upload`** uses `fetch` to POST, then appends `{ url, filename, uploadedAt }` to `localStorage` key `example-src-uploaded-images` (max 48 entries). That list is:

- Per browser, per origin
- Easy to clear without deleting files on disk
- **Not** suitable for production catalogues

## Upgrading to a DB-backed site

Copy the pattern from **example-auth** `config/config.ts`:

1. Set `adapter: 'smugmug'` (or `'uploadthing'` with `uploadThingSecret` in the constructor).
2. Register the machine under `config.database.machines`.
3. Add `images` (and optionally `albums`) to `config.database.schemas`.
4. Omit `persistToDatabase: false` (default persists to MySQL).

See `server/images/README.md` in the Thalia repo for constructor options and route names (`/uploadImage` vs `/uploadPhoto`).
