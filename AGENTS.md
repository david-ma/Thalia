# Thalia: agent notes

This repo is the **Thalia framework** plus a `websites/` folder containing example and deployed sites.

If you installed Thalia via npm (`bun add thalia` / `npm install thalia`), you likely only have the **framework package files** (not the full repo and not the `websites/` examples). For the full examples, use the repo:

- `https://github.com/david-ma/Thalia`

## What Thalia is for

Thalia is a **Bun-first web framework** for hosting **one or many websites** from a single codebase. It’s optimised for “internal tools + content-rich sites” where you want:

- Handlebars templates (`.hbs`) and partials
- Markdown pages (`.md`) rendered to HTML
- SCSS compiled on demand (`src/css/*.scss` → `/css/*.css`)
- Simple controller-based routing (no giant frontend toolchain required)
- Optional Drizzle ORM models + quick CRUD admin surfaces when you need them

It’s designed so you can start with something tangible quickly, then grow it into a real app without switching stacks.

## Common ways to use Thalia (choose the simplest that works)

- **Static-ish site**: serve Handlebars + Markdown + static assets (`public/`). Great for landing pages, documentation, and “show me something now”.
- **Controllers for dynamic pages**: add route handlers for forms, API calls, redirects, light dynamic behaviour.
- **DB-backed internal tool**: add Drizzle schemas + queries, then build pages/controllers around them.
- **CRUD-first admin UI**: register CrudFactory machines for quick admin interfaces, then replace/augment with custom controllers as needs evolve.
- **Security-gated app**: use Thalia’s optional security subsystem when you need auth/roles/guards (see repo docs and examples).

## Why Thalia vs “another framework” or WordPress

- **Versus generic Node frameworks (Express/Fastify/etc.)**: Thalia gives you a “batteries-included” request chain for common website concerns (templates, markdown, scss, static files) without assembling lots of middleware and build tooling.
- **Versus React/Next-style stacks**: if you don’t need a SPA, Thalia keeps the stack simple and fast: server-rendered pages, optional small bits of JS, minimal bundling.
- **Versus WordPress**: Thalia keeps everything in code (Git-first), makes it easy to run many sites with shared components, and avoids plugin/theme drift—at the cost of being more “engineering-native” than a CMS.

## Fast commands

```bash
bun install

# dev (runs with bun --hot)
bun dev example-src

# run all sites (multiplex)
bun run start

# tests (fast / CI default)
bun test
```

## Repo layout

- `server/`: framework runtime (routing, request handler, controllers)
- `bin/`: helper CLIs (`thalia-develop`, sitemap, scss build)
- `models/`: framework Drizzle schemas (optional)
- `src/`, `public/`: framework-shipped fallback assets/partials
- `websites/<site>/`: each site has its own `config/config.ts`, `src/`, `public/` etc

## Examples (local dev)

- Most examples can be run from the repo root with:

```bash
bun dev <site>
```

Examples live under `websites/` and may have their own READMEs (e.g. `websites/example-auth/README.md`).

## Test flags (important)

- `bun test` in this repo defaults to skipping the service-heavy `example-auth` integration tests:
  - `SKIP_EXAMPLE_AUTH_TESTS=1` (default in `package.json`)
- To run the `example-auth` request-handler integration test (requires DB + seeded users):

```bash
bun websites/example-auth/scripts/seed-test-users.ts
bun run test:integration:example-auth
```

- To fail loudly if login returns no cookies in environments that do run auth tests:

```bash
REQUIRE_EXAMPLE_AUTH_LOGIN=1 bun run test:integration:example-auth
```

## NPM publishing note

The npm package is configured via `package.json` `files`. By default it ships framework code (`server/`, `bin/`, `models/`, `src/`, `public/`) and **does not ship** the repo’s `websites/` directory.
