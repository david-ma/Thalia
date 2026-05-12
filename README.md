# Thalia

Thalia is a Bun-first web framework for hosting **one or many websites** from a single repo. It’s optimised for “internal tools + content-rich sites”: Handlebars templates, Markdown pages, on-demand SCSS compilation, and simple controller-based routing.

This repository is the framework **and** includes a few example websites under `websites/`.

## Status

- **Runtime**: Bun (ESM, TypeScript-first)
- **Templating**: Handlebars (`.hbs`)
- **Content pages**: Markdown (`.md`) rendered to HTML
- **Styling**: SCSS compiled on demand (`src/css/*.scss` → `/css/*.css`)
- **DB layer**: Drizzle ORM (commonly MySQL/MariaDB via `mysql2`)
- **Auth**: Optional security subsystem (`thalia/security`) used by `websites/example-auth`

The framework does not ship a webpack toolchain; browser TypeScript and SCSS are handled on demand by the server (`tryTypescript`, `tryScss`) or by `bun run build:scss` for static CSS.

## Repo layout (current)

```
.
├── server/                   # Framework runtime (server, routing, request handler chain)
├── models/                   # Drizzle schemas used by the framework (optional)
├── bin/                      # Framework helper CLIs (dev, sitemap, SCSS build)
├── websites/                 # Example / deployed sites (each has its own config + src + public)
│   ├── example-minimal/
│   ├── example-src/
│   └── example-auth/         # Auth + DB-backed example (heavier integration tests)
├── tests/                    # Unit + integration + E2E tests (Bun)
└── src/                      # Framework-shipped assets/partials (served as fallback)
```

Each website typically looks like:

```
websites/<site>/
├── config/config.ts
├── src/                      # templates, markdown, scss, (optional) TS for browser
├── public/                   # static assets served directly
├── dist/                     # optional prebuilt assets (if you precompile)
└── models/                   # optional site-specific Drizzle tables
```

## Install

```bash
bun install
```

## Run

Thalia can run in two main modes:

- **Standalone (single project)**: run from a website directory that does *not* contain a `websites/` folder.
- **Multiplex (many projects)**: run from the Thalia root (this repo) and serve projects out of `websites/`.

### Serve all websites (multiplex)

```bash
bun run start
```

### Serve one website (from Thalia root)

```bash
bun server/cli.ts --project=example-src
```

### Development mode (`thalia-develop`)

Runs the Thalia server with `bun --hot`. Use the app URL printed in the logs (same `PORT` as the child process).

```bash
bun run dev example-src
```

## Request handling (high level)

Thalia’s request handler is a chain. In broad strokes it tries:

- path exploit checks / route guard
- controllers
- `dist/` (optional)
- SCSS (`src/css`)
- TypeScript-to-browser-JS (`src/js`)
- Handlebars templates (`src/**/*.hbs`)
- Markdown (`src/**/*.md`)
- `public/`, then `docs/`, then `data/`
- framework `public/` + directory index + 404

## Tests

```bash
bun test
```

Targeted runs:

```bash
bun run test:unit
bun run test:integration
```

The default `bun run test` script sets **`SKIP_EXAMPLE_AUTH_TESTS=1`** so the suite passes without MySQL and seeded users (same idea as CI). To run **only** the request-handler integration file with example-auth enabled (needs DB + schema push + **`bun run example-auth:seed-test-users`** — see `websites/example-auth/README.md`):

```bash
bun run example-auth:seed-test-users
bun run test:integration:example-auth
```

To **fail** if the example-auth server starts but logins return no cookies (catch silent no-ops in CI that does run example-auth):

```bash
REQUIRE_EXAMPLE_AUTH_LOGIN=1 bun run test:integration:example-auth
```

**Database “online” integration** (`tests/Integration/database-online.test.ts`) exercises example-auth against a **live MySQL/MariaDB** (Crud **`/json`** counts, seeded logins, profile updates). The suite runs **only** when **`SKIP_DATABASE_TESTS=0`**; the default **`bun run test`** sets **`SKIP_DATABASE_TESTS=1`** so CI and laptop runs stay green without a database. From Thalia root:

```bash
bun run example-auth:seed-test-users   # upserts test users (see websites/example-auth/README.md)
bun run test:integration:database      # same as SKIP_DATABASE_TESTS=0 bun test tests/Integration/database-online.test.ts
```

If MySQL is down or seed users are missing, those tests **fail** (they do not pass by skipping).

### SmugMug (fixtures + optional live READ)

Golden OAuth/signing fixtures live under **`tests/fixtures/smugmug/`**; unit coverage is in **`tests/Unit/smugmug-*.test.ts`**. Use **`tests/helpers/smugmug-fixtures.ts`** (`sampleSmugImageInsertRow()`) when seeding local MariaDB rows from the sample upload + AlbumImage payloads.

For uploads, **`smugmug.album` / `SMUGMUG_ALBUM` / `config.smugmug.album`** accepts a bare album key, an `/api/v2/album/…` API path (with or without a leading slash), or a **`https://api.smugmug.com/api/v2/album/…`** URL; gallery webpage URLs alone are rejected for the upload header (`normalizeSmugMugAlbumUri` in **`server/smugmug/album-uri.ts`**).

**`/uploadPhoto`** supports **`application/json`** bodies (UploadThing-style): provide **`uploadThingUrl`**, **`fileUrl`**, or **`url`** (first non-empty wins) plus optional **`caption`**, **`title`**, **`keywords`**, **`filename`**, **`mimeType`**. The server **GET**s the HTTPS URL with **manual redirects** and SSRF guards (**`server/smugmug/remote-image-fetch.ts`**), then uploads bytes to SmugMug the same way as the legacy multipart form. Multipart **`fileToUpload`** behaviour is unchanged.

Optional **signed GET smoke** against a sandbox account (**no uploads**, no writes via this path):

```bash
# Never set SMUGMUG_WRITE in CI — it is intentionally ignored here; uploads stay out of default automation.
SMUGMUG_READ_CI=1 \
SMUGMUG_CONSUMER_KEY="…" \
SMUGMUG_CONSUMER_SECRET="…" \
SMUGMUG_OAUTH_TOKEN="…" \
SMUGMUG_OAUTH_TOKEN_SECRET="…" \
bun test tests/Integration/smugmug-read-live.test.ts
```

The default **`bun test`** / GitHub Actions job does **not** set **`SMUGMUG_READ_CI`** (see `.github/workflows/tests.yml`).

SmugMug upload/API paths emit **one JSON line per request** to stdout/stderr (`service: "smugmug"`, `operation`, `durationMs`, `httpStatus`, `website`, …) via **`server/smugmug/log.ts`** — never **`oauth_*`** values; free-text **`msg`** fields are passed through **`redactLogText`**.

### Service-dependent tests (DB / MailCatcher)

The `websites/example-auth` fixture exercises Thalia’s auth + route guard + mail flows and **expects external services** in some scenarios (database; MailCatcher for an end-to-end password-reset test).

For fast, deterministic runs you can skip those (also the default for `bun run test`):

```bash
SKIP_EXAMPLE_AUTH_TESTS=1 SKIP_MAILCATCHER_TESTS=1 bun test
```

## CI

GitHub Actions runs the fast test suite by default (skipping `example-auth` + MailCatcher dependent tests). See `.github/workflows/tests.yml`.

## License

GPLv3 (see `LICENSE`).
