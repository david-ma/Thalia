# example-auth

Example Thalia project with **ThaliaSecurity**, **RoleRouteGuard**, and a DB-backed CRUD controller. Used by integration tests and as a reference for auth setup.

## What’s in it

- **ThaliaSecurity** (mail auth, users/sessions/audits)
- **RoleRouteGuard** with `config.routes` (path + permissions for admin/user/guest)
- **Fruit** CRUD (CrudFactory) at `/fruit` with route rule allowing guest read
- Optional: albums/images (from SmugMug-style config); can be removed to keep the example minimal

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

| Path            | Guest     | User (logged in) | Admin   |
|-----------------|-----------|------------------|--------|
| `/`             | 401 login | 200              | 200    |
| `/fruit`        | 200 read  | 200 read         | 200 CRUD |
| `/profile/:id`  | 401       | 200 view any     | 200 view/edit any |
| `/profile/:id` (edit) | —  | 200 only if owner | 200    |
| `/admin`        | 401       | 403              | 200    |

- **User profiles**: Viewable by any logged-in user. Editable only by the profile owner or an admin. The route guard enforces "user can read /profile"; the **profile controller** enforces "edit only if `requestInfo.userAuth.userId === :id` or `userAuth.role === 'admin'`".

### Implementation phases

1. **Routes** — Expand `config.routes` so that: `/` requires at least user (guest gets 401); `/fruit` stays as today; `/profile` allows user read and admin full; `/admin` remains admin-only.

2. **Profile controller** — `GET /profile/:id` shows profile (allowed if logged in). `POST/PUT /profile/:id` updates only if `userAuth.userId === id` or `userAuth.role === 'admin'`; otherwise 403.

3. **Tests** — Guest: `GET /` → 401, `GET /fruit` → 200, `GET /profile/1` → 401, `GET /admin` → 401. User: view any profile, edit only own; `PUT /profile/2` → 403. Admin: full access. Use `POST /logon` to get session cookie for authenticated tests; skip if DB/login unavailable.

4. **Not yet built** — Owner-based edit enforcement in profile controller; optional dedicated profile table.

### Running the tests

From Thalia root: `bun test tests/Integration/request-handler.test.ts`. For full coverage, set up the DB and optionally seed a user.

---

## Tests

Integration tests in `tests/Integration/request-handler.test.ts` start example-auth and assert route guard + controller behaviour. If the DB isn’t available, the suite still passes and those tests no-op.
