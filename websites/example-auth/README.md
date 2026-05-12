# example-auth

Example Thalia project with **ThaliaSecurity**, **RoleRouteGuard**, and a DB-backed CRUD controller. Used by integration tests and as a reference for auth setup.

## What’s in it

- **ThaliaSecurity** (mail auth, users/sessions/audits)
- **RoleRouteGuard** with `config.routes` (path + permissions for admin/user/guest)
- **`config/config.ts`** — start here: the file header documents how to merge `securityConfig()`, optional modules, and typed `RoleRouteRule[]` routes
- **Fruit** CRUD (CrudFactory) at `/fruit` with route rule allowing guest **read** only (create/update/delete need higher roles)
- Optional: albums/images (from SmugMug-style config); can be removed to keep the example minimal

## First administrator

With an empty database, open **`/setup`** and submit the one-time form — it creates the first **`admin`** account. After that, **`/setup`** only shows a closed message; use **`/logon`**. Additional accounts can use **`/newUser`** (role `user`) unless you disable self-registration (see `ThaliaSecurity` options below).

To **turn off `/newUser`** and omit the `createNewUser` controller entirely, pass `disableSelfRegistration: true` into `new ThaliaSecurity({ … })` (and drop the `/newUser`/`/createNewUser` route rules from your merge if you declared them).

## Database

Uses **MySQL/MariaDB**. Credentials are read from:

1. **`DATABASE_URL`** (e.g. `mysql://user:pass@localhost:3377/example_auth`) if set, or  
2. **`docker-compose.yml`** in this directory (project root). The config resolves paths from the config file’s directory, so it works when you run `bun dev example-auth` from the Thalia repo root.

### Run with Docker

From this directory (or with `DATABASE_URL` set):

```bash
cd /path/to/Thalia/websites/example-auth
docker compose up -d
bun drizzle-kit push   # create/update tables
```

Then from Thalia root:

```bash
bun dev example-auth
```

### Without Docker

Set a connection string and run migrations yourself:

```bash
export DATABASE_URL="mysql://user:password@localhost:3306/example_auth"
cd websites/example-auth
bun drizzle-kit push
```

## Tables

- **users**, **sessions**, **audits** – from ThaliaSecurity (required for route guard + login)
- **fruit** – example CRUD table
- **albums**, **images**, **mail** – optional (from merged config); can be dropped if you simplify the example

If you only have `fruit`, `albums`, `images` (half-finished setup), create the auth tables by running migrations from this directory:

```bash
cd websites/example-auth
bun drizzle-kit push
```

That pushes the full schema (including users, sessions, audits) from `models/drizzle-schema.ts`.

## Drizzle and CJS

`drizzle-kit` loads `drizzle.config.ts` and the schema file as **CommonJS**. Two things to watch for:

1. **Config: no `import.meta`**  
   In CJS, `import.meta` is not available, so using it in the config causes “import.meta is not available with the cjs output format”. Use `__dirname` when it exists (CJS), and only use `import.meta` in an ESM fallback, e.g.  
   `const projectRoot = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));`

2. **Schema: don’t rely on Thalia’s package exports**  
   Under `require()`, Node resolves `thalia/models` via Thalia’s `package.json` exports, which can lead to `ERR_PACKAGE_PATH_NOT_EXPORTED`. Import from the installed package on disk instead:  
   `from '../node_modules/thalia/models'` and `from '../node_modules/thalia/server/mail'` (and `../node_modules/thalia/models/util` in local model files). Use `'./fruit'` (no `.js`) for local schema files so the loader can resolve `.ts`.

Same pattern is used in `websites/smugmug`.

## SQLite instead of MySQL?

Using SQLite would avoid Docker and YAML, but Thalia’s **database layer and security models are currently MySQL-only** (`server/database.ts`, `models/security-models.ts`). Switching example-auth to SQLite would require either (a) adding SQLite support and SQLite variants of users/sessions/audits in the framework, or (b) a separate minimal example that doesn’t use ThaliaSecurity. The **integration tests** only assert HTTP behaviour (route guard runs, 200/401, etc.); they don’t care whether the backend is MySQL or SQLite, so using SQLite for this example wouldn’t invalidate those tests—but it would need the framework changes above first.

## Plan: guest / user / admin and user profiles

This section describes the intended behaviour and test coverage. Some features may not be implemented yet; tests document the contract and can fail until the feature exists.

### Route and permission matrix

| Path | Guest | User (logged in) | Admin |
|------|-------|------------------|-------|
| `/` | 200 (read) | 200 | 200 |
| `/fruit` | 200 list | 200 list | full CRUD |
| `/fruit/new` (create) | 401 | 403 | allowed via CRUD rule |
| `/profile` / `/profile/:id` | 401 | 200 view (`:id`), update only own or admin | full |
| `/admin` | 401 | 403 | 200 |
| `/users/...` (User CRUD) | 401 | 200 read (e.g. list) | full CRUD (`ThaliaSecurity` default route) |
| `/sessions/...`, `/audits/...` | 401 | 403 | full CRUD (defaults from `securityConfig()`) |

- **Profiles**: Route guard grants **user** + **admin** read/update on `/profile`. **`profileController`** still enforces “edit only if owner or **`userAuth.role === 'admin'`**”.
- **`/users` vs `/user`**: Framework defaults guard the **`users`** controller prefix (`/users/...`). See `RoleRouteGuard` longest-prefix matching in `server/route-guard.ts`.

### Implementation status

Routes, profile controller, and integration tests in `tests/Integration/request-handler.test.ts` reflect the matrix above (`SKIP_EXAMPLE_AUTH_TESTS=0`, DB + seeded users).

### Running the tests

From Thalia root: `bun test tests/Integration/request-handler.test.ts`. For full coverage, set up the DB and optionally seed a user.

---

## Tests

Integration tests in `tests/Integration/request-handler.test.ts` start example-auth and assert route guard + controller behaviour. The repo’s default `bun run test` sets **`SKIP_EXAMPLE_AUTH_TESTS=1`** (no MySQL required).

To run example-auth integration tests locally:

1. Start MariaDB (e.g. `docker compose up -d` in this directory) or set **`DATABASE_URL`**.
2. **`bun drizzle-kit push`** from this directory so `users`, `sessions`, etc. exist.
3. From Thalia root: **`bun websites/example-auth/scripts/seed-test-users.ts`** — upserts **`user@example-auth.test`** (role `user`) and **`admin@example-auth.test`** (role `admin`) with password **`test-password`**. Without this step, authenticated tests no-op because login returns no cookie.
4. **`bun run test:integration:example-auth`**. Add **`REQUIRE_EXAMPLE_AUTH_LOGIN=1`** to fail fast if logins still do not yield cookies.

Logins in tests read **`Set-Cookie`** via **`getSetCookie()`** where available so `sessionId` is not dropped.

### Database-online tests (`database-online.test.ts`)

These hit **real HTTP + Drizzle + MySQL** (Crud **`/json`** totals, **`/fruit`**, seeded **`PUT /profile`** flows). They run **only** when **`SKIP_DATABASE_TESTS`** is exactly **`0`** — anything else (**unset**, **`1`**, …) treats the whole file as **`describe.skip`** in Bun.

From Thalia root (after DB is up and schema is pushed):

```bash
bun websites/example-auth/scripts/seed-test-users.ts
bun run test:integration:database
```

Or: **`SKIP_DATABASE_TESTS=0 bun test tests/Integration/database-online.test.ts`**.

### SQLite instead of MySQL?

Thalia’s **`ThaliaDatabase`** and security CRUD use **`drizzle-orm/mysql2`** and **`mysql-core`** table builders (`server/database.ts`). Moving example-auth to SQLite would mean a second driver path, schema dialect differences (e.g. `varchar`, autoincrement), and retesting security—not “swap the URL”. Bun’s built-in SQLite does **not** remove that work. **MariaDB in Docker + the seed script above** is the supported path for integration tests without redesigning the framework.
