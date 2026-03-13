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

## SQLite instead of MySQL?

Using SQLite would avoid Docker and YAML, but Thalia’s **database layer and security models are currently MySQL-only** (`server/database.ts`, `models/security-models.ts`). Switching example-auth to SQLite would require either (a) adding SQLite support and SQLite variants of users/sessions/audits in the framework, or (b) a separate minimal example that doesn’t use ThaliaSecurity. The **integration tests** only assert HTTP behaviour (route guard runs, 200/401, etc.); they don’t care whether the backend is MySQL or SQLite, so using SQLite for this example wouldn’t invalidate those tests—but it would need the framework changes above first.

## Tests

Integration tests in `tests/Integration/request-handler.test.ts` start example-auth and assert route guard + controller behaviour. If the DB isn’t available, the suite still passes and those tests no-op.
