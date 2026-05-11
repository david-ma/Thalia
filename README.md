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

Some older/optional pieces (e.g. webpack watch in `bin/develop.ts` when a webpack config exists) are not required for the framework to run.

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

Runs the Thalia server with `bun --hot` (and optional webpack watch if the project has a webpack config). Use the app URL printed in the logs (same `PORT` as the child process).

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

### Service-dependent tests (DB / MailCatcher)

The `websites/example-auth` fixture exercises Thalia’s auth + route guard + mail flows and **expects external services** in some scenarios (database; MailCatcher for an end-to-end password-reset test).

For fast, deterministic runs you can skip those:

```bash
SKIP_EXAMPLE_AUTH_TESTS=1 SKIP_MAILCATCHER_TESTS=1 bun test
```

## CI

GitHub Actions runs the fast test suite by default (skipping `example-auth` + MailCatcher dependent tests). See `.github/workflows/tests.yml`.

## License

GPLv3 (see `LICENSE`).
