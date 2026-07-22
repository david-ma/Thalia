# Thalia security (sites and framework)

This document explains how **authentication**, **sessions**, and **coarse route permissions** fit together, and what you configure in a site’s `config/config.ts`.

## Mental model

1. **`ThaliaSecurity`** (`thalia/security`) is an optional **factory**: call `new ThaliaSecurity({ … }).securityConfig()` and **merge** the returned fragment into your exported `config` (users/sessions/audits schemas, auth controllers, default admin routes, `thaliaAuth` defaults). It does **not** run as a gatekeeper by itself; it **declares** data and routes the framework uses.
2. **`RoleRouteGuard`** (`server/route-guard.ts`) is the **HTTP gatekeeper** when your site is configured with the security database machines (`users`, `sessions`, and `audits`). It runs **very early** on every normal request, before controllers, static files, Handlebars, or Markdown.
3. **Route rules** live on `Website.config.routes` as `RoleRouteRule[]` (plus a small built-in allow-list). They describe, per **URL prefix** and **role**, which **CRUD-style permissions** are allowed.

Finer rules (“only edit your own row”, “hide this field for non-owners”) belong **inside controllers** (for example `ProfileControllerFactory` in this package).

## When the role-based guard is active

In `Website.create`, the framework picks a guard:

- If `config.database.machines` includes **`users`**, **`sessions`**, and **`audits`** → **`RoleRouteGuard`** (session lookup + RBAC).
- Else if `config.routes.length > 0` → **`BasicRouteGuard`** (password/proxy style rules only).
- Else → **`RouteGuard`** (no-op pass-through).

### BasicRouteGuard (`password` routes)

For sites without the security database, `config.routes` entries may use **`password`**, **`proxyTarget`**, or both. Optional modifiers (not used by `RoleRouteGuard`):

| Field | Effect |
| ----- | ------ |
| `node_env` | Enforce `password` only when `RequestInfo.node_env` matches (e.g. `'production'`). Other environments skip the login gate. |
| `ip_whitelist` | Comma-separated IPv4 addresses or CIDR blocks (e.g. `192.168.0.0/24`) that skip `password` — useful for LAN access while keeping a password in production. |

`proxyTarget` still applies in **all** environments when the route matches, even if `password` is skipped.

So enabling **`ThaliaSecurity.securityConfig()`** (which registers those machines) is what **turns on** `RoleRouteGuard`, not importing the class yourself.

## Request pipeline (where RBAC runs)

`RequestHandler` chains: path check → **`routeGuard.handleRequestChain`** → controller → static/SCSS/TS/Handlebars/Markdown → …

So the guard applies to **anything** that reaches that pipeline: pages, APIs served by your controllers, and anything that falls through to templates or static files **if** a matching route rule exists for that host + path. It is not “controllers only”; it is **per HTTP request**, before the rest of the stack.

**WebSockets** are not covered by this guard today (see comments in `server/server.ts`).

## Roles and sessions

- **Roles** are currently **`admin`**, **`user`**, and **`guest`** (`Role` in `server/route-guard.ts`).
- **`guest`** means no valid session (or no session cookie), locked user treated as guest, or database unavailable for session resolution (no `db` / Drizzle).
- **`user` / `admin`** come from the **`users.role`** column joined via **`sessions`** for the `sessionId` cookie.

The guard attaches **`requestInfo.userAuth`** and **`requestInfo.permissions`** (the permission array for the matched route + role) before later stages run.

## What `read`, `create`, `update`, `delete` (and `manage`) mean

They are **string tokens** checked by `RoleRouteGuard`: the guard computes a single required **`Permission`** for this request and tests **`requestInfo.permissions.includes(thatPermission)`**.

The required permission is **not** taken from HTTP method directly. It comes from **`CrudFactory.getAction(requestInfo)`** (`server/controllers.ts`), which maps the **second URL path segment** (`requestInfo.action`, from `server/server.ts` URL parsing) to a permission:

| URL shape (simplified) | Typical `action` | Mapped permission |
| ---------------------- | ------------------ | ----------------- |
| `/resource` (no second segment) | `''` → treated like **`list`** | **`read`** |
| `/resource/list`, `/resource/json`, … | `list`, `json`, `columns` | **`read`** |
| `/resource/new`, `create`, `testdata` | `new`, `create`, … | **`create`** |
| `/resource/edit`, `update`, `restore` | `edit`, `update`, `restore` | **`update`** |
| `/resource/delete` | `delete` | **`delete`** |
| Unknown action string | default | **`read`** |

**Implications for site authors**

- A **GET** to `/profile` and a **POST** to `/profile` both use `action === ''` unless your path is `/profile/...` with a second segment—so both usually require **`read`** on the `/profile` route rule, not `create`/`update` from the HTTP verb.
- CRUD-style URLs like `/users/123/edit` line up with **`update`** because the router still exposes path semantics the CRUD controllers expect; the guard reuses the same mapping.
- For **resource-level** authorization, still validate inside the controller.

There is also a **`manage`** permission type for rules if you need a broader capability; CRUD’s default mapper does not emit `manage`.

## Route rules: `RoleRouteRule` and matching

Each rule has:

- **`path`**: URL prefix (e.g. `/`, `/admin`, `/fruit`). Normalized and combined with each **`domain`** from the rule or from `config.domains`.
- **`permissions`**: for each role, an array of allowed **`Permission`** values on paths under that prefix.

**Matching**: keys are `host + normalizedPath` (see `BasicRouteGuard.getMatchingRoute`). The **longest** matching prefix wins (`routeFullpathMatchesMappedKey`).

**No matching rule**: if nothing matches, `RoleRouteGuard` **passes the request through** (same as “not configured here”). So you must add rules for prefixes you want behind RBAC.

### Built-in allow list

`BasicRouteGuard.loadRoutes` (`server/route-guard.ts`) **prepends** synthetic rules for auth pages and common static prefixes (`/css`, `/js`, `/images`, …) so login pages and assets work when security is on. Those entries grant **`read`** to all three roles unless you strip registration paths when `thaliaAuth.disableSelfRegistration` is true.

Project routes from **`config.routes`** are merged after that list (via `concat`).

### Default rules from `ThaliaSecurity`

`securityConfig()` includes `routes: default_routes` from `server/security/security-default-routes.ts` (e.g. `/admin` admin-only, `/users` mostly admin, users get `read`, `/sessions`, `/audits`). Your site should **`recursiveObjectMerge`** its own `RoleRouteRule[]` **after** `securityConfig()` so you extend `/`, `/profile`, feature paths, etc. (see `websites/example-auth/config/config.ts`).

## Deny behaviour

- **`guest`** without the required permission → **401** and the login HTML (`website.getContentHtml('userLogin')`).
- Logged-in **`user` / `admin`** without the permission → **403** plain “Access denied”.

## What you configure as a site developer

| Area | Where / what |
| ---- | -------------- |
| Enable packaged security | `recursiveObjectMerge({}, security.securityConfig(), …)` so machines + default routes exist |
| Extra tables / controllers | Your own `database`, `controllers`, etc. merged into `config` |
| **Path RBAC** | `config.routes`: `RoleRouteRule[]` with `path` + `permissions` per role |
| Hostnames | `config.domains`: must include hosts you actually use; matching uses `requestInfo.host` (see `X-Forwarded-Host` handling in `server/server.ts`) |
| Session / signup tuning | `config.thaliaAuth` (defaults from `ThaliaSecurity.defaultThaliaAuthOptions()`): e.g. `disableSelfRegistration`, `disablePasswordReset`, `sessionMaxAgeSeconds` |
| Mail-backed flows | `ThaliaSecurity` constructor options such as `mailAuthPath` |
| Login throttle | Default on auth POSTs: **5** attempts per client IP per action in **15 minutes** → **6 hour** ban (`auth_login_throttles`). Actions: `logon` (failed passwords only), `forgotPassword` / `resetPassword` / `setup` / `createNewUser` (every POST). Keyed by IP+action so attackers cannot lock a victim account. Signed-in users see a clearer message; guests get a short one. Schema is in `securityConfig()` — migrate / `drizzle-kit push` after upgrading. |
| Types | Import `RoleRouteRule` from `thalia/security` (re-exported from `server/route-guard.ts`) |

## Public API surface

Import from **`thalia/security`** (`server/security/index.ts`): `ThaliaSecurity`, `SecurityService`, `ProfileControllerFactory`, session helpers, and `RoleRouteRule` types. Implementation files under `server/security/` are split for maintenance; the barrel is the supported import path for apps.

## Related files

- `server/route-guard.ts` — `RoleRouteGuard`, `Permission`, `UserAuth`, route loading.
- `server/request-handler.ts` — handler chain order.
- `server/server.ts` — `RequestInfo` (including `action` from the URL).
- `server/controllers.ts` — `CrudFactory.getAction`.
- `server/security/thalia-security.ts` — `securityConfig()` and auth controllers.
- `server/security/security-default-routes.ts` — default `RoleRouteRule`s for admin tooling.
