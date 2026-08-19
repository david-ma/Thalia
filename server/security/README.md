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
- **`guest`** means no valid session (or no session cookie), no successful **Bearer** hook result, locked user treated as guest, or database unavailable for session resolution (no `db` / Drizzle).
- **`user` / `admin`** come from the **`users.role`** column joined via **`sessions`** for the `sessionId` cookie, **or** from optional **`config.resolveBearerUserAuth`** when the request has `Authorization: Bearer …` (Homelab extension tokens). Bearer is tried first; a `user`/`admin` result wins. `null` / errors fall through to the cookie. Chrome new-tab can still send a site cookie; Firefox `moz-extension://` usually cannot, so the hook is required for the extension.

### Ending sessions (logout / password reset)

Session rows are **credentials**, not CRUD soft-delete records. Auth validity (`RoleRouteGuard`) requires `logged_out = false` and an unexpired `expires`.

**Never hard-DELETE session rows** from application code. `audits.session_id` references `sessions.sid` (`ON DELETE NO ACTION`), so a DELETE fails with MySQL errno 1451 when any audit still points at that `sid`. Worse: password reset updates the password hash *before* session cleanup — a failed DELETE leaves the new password stored while the user sees a generic error.

**Soft-revoke instead:** set `logged_out = true` (helpers in `session-revoke.ts`: `revokeSessionBySid`, `revokeSessionsForUser`, `revokeOtherSessionsForUser`). The row remains so audits keep a real FK target; the cookie stops authenticating. Do not add a parallel `deleted_at` on sessions for this — keep one invalidation signal (`logged_out` + `expires`).

Site code that ends sessions after a password change should call the same soft-revoke pattern (not `DELETE FROM sessions`).

The guard attaches **`requestInfo.userAuth`** and **`requestInfo.permissions`** (the permission array for the matched route + role) before later stages run.

## Profile + password change (supported path)

**Supported profile UI:** site Handlebars partial (e.g. `profile_content.hbs`) served by **`ProfileControllerFactory`** from `thalia/security`. The framework file **`src/views/security/profile.hbs`** is a **legacy demo only** — not wired by `ThaliaSecurity` or the factory.

| Surface | How |
| ------- | --- |
| GET/PATCH profile (name, photo) | `ProfileControllerFactory.controller` at `/profile/:id` (site wires the factory) |
| Change password (signed-in) | **`POST /api/profile/password`** — registered by **`security.securityConfig()`** by default |
| Forgot / reset (email token) | `ThaliaSecurity` `/forgotPassword` → `/resetPassword` |

### `POST /api/profile/password`

**On by default** when you merge `security.securityConfig()` (controller + `/api/profile` route, no guest). Opt out with `new ThaliaSecurity({ disablePasswordChange: true })` or `thaliaAuth.disablePasswordChange`.

Body: `{ currentPassword, newPassword, confirmPassword }` (8–1024 chars for new password).

- Identity from **session only** (`userAuth.userId`). Body fields `userId` / `email` / `username` → **`IDENTITY_NOT_ALLOWED`**.
- Verifies current password; updates hash; clears reset tokens; sets `verified: true`.
- Soft-revokes **other** sessions (`revokeOtherSessionsForUser`); keeps the current cookie.
- Same-origin CSRF check (`assertSameOriginMutation`).
- Success: `{ ok: true, otherSessionsRevoked: boolean }`. Errors: `{ error, code }` (`ProfilePasswordJsonErrorCode`).

Sites only need a UI that posts to the endpoint (see **example-auth** `profile_content.hbs`). Advanced overrides: `createProfilePasswordController` / `profilePasswordControllerTree` from `thalia/security`.

Homelab sites with a local `profile-password-api.ts` should switch to the framework endpoint after upgrading `thalia`.

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

## Reserved `/admin` (when Security is on)

Activating **`securityConfig()`** does **two** things to `/admin`:

1. **Auth** — `default_routes` grants `/admin` to the **admin** role only (`RoleRouteGuard`). Guests get 401; other users get 403. This is the real security boundary.
2. **Controller claim** — `controllers.admin` is registered as a **leaf function** that serves a short framework scaffold (`src/views/security/admin.hbs`). `RequestHandler.tryController` stops at the first function, so **`/admin` and `/admin/*` all hit that scaffold** until the site takes over. Keep that scaffold generic; teaching copy and worked examples live in **`websites/example-auth`** (and unprotected `/admin` in **`websites/example-src`**).

That reservation is intentional: enabling auth is a good moment to move powerful pages, or to re-serve them deliberately under `/admin`. It is **not** the same as “HBS under `/admin` is unsafe” — site templates under `/admin` remain behind the same route rule.

### Controller walk (short)

Path segments walk `controllers` until a **function** runs. Remaining segments are **not** nested controller keys. One function must handle catalog + detail when needed (e.g. `/admin/deck` and `/admin/deck/:id`).

### Taking over `/admin` (preferred pattern)

Merge an **object** over the framework function (`recursiveObjectMerge` replaces a function with an object). List pages explicitly with **`wrap()`** from `thalia/controllers` (or a custom controller) — no new Handlebars renderer:

```ts
import { wrap } from 'thalia/controllers'
import { claimAdminNamespace } from 'thalia/security'

controllers: {
  admin: claimAdminNamespace({
    overview: wrap('admin_overview.hbs'),
  }),
}
```

- **`claimAdminNamespace`** is a readability helper (returns the map; documents intent).
- With an object at `admin`, **`/admin`** (no further segment) falls through to **`tryHandlebars`** (`src/admin.hbs` or `src/admin/index.hbs`) if you do not register an index controller.
- **`admin: {}` alone** still clears the leaf so raw `src/admin/*.hbs` fallthrough works, but config readers cannot see which admin pages exist — prefer the explicit map for powerful UI.
- **`wrap('….hbs' | '….md')`** is the preferred config helper: extension picks Handlebars vs Markdown rendering and injects **`requestInfo`** + **`version`** (`website.version`) — same core context as Handlebars fallthrough. Static `data` overrides those keys when both set. Prefer `wrap` over calling `hbs` / `md_file` directly.

See **`websites/example-auth`**: hub at `/admin` (`src/admin.hbs`) + `/admin/overview` via `wrap('admin_overview.hbs')`.  
See **`websites/example-src`**: `src/admin/index.hbs` at `/admin` with **no** Security — open to everyone (contrast).

### Other reserved prefixes from `securityConfig()`

| Prefix | Default intent |
| ------ | -------------- |
| `/admin` | Admin-only UI namespace (scaffold until claimed) |
| `/users` | User CRUD machine (do not use as a password UI) |
| `/sessions`, `/audits` | Admin-oriented CRUD |
| Auth pages (`/logon`, `/setup`, …) | Allow-listed for guests where needed |
| `/privacy-policy`, `/cookie-policy`, `/terms-of-use` | Guest-readable legal pages (Handlebars fallthrough); see below |

### Privacy, cookie, and terms pages

Thalia ships default pages as ordinary Handlebars files:

- `src/privacy-policy.hbs`
- `src/cookie-policy.hbs`
- `src/terms-of-use.hbs`

`tryHandlebars` serves **site** `src/<path>.hbs` first, then falls back to the framework package `src/<path>.hbs`. **No controllers** are registered for these paths — that would block the file override.

When **RoleRouteGuard** is on, the built-in allow list (and matching default `RoleRouteRule`s from `securityConfig()`) grants **`guest` / `user` / `admin` → `read`** so guests are not redirected to login.

Default copy is intentionally generic (operator / Website, Privacy Act / APPs, Australian Consumer Law). Override by placing the same filename under the site’s `src/`.

**Discoverability:** default **`userLogin`** (and related auth surfaces) include **`{{> policy-links }}`**. Optional site footer: **`{{> policy-footer }}`**.

**Opt out:** override with your own page, or claim the path with a site controller that 404s/redirects. Filtering route rules alone is not enough while allow-list entries remain.

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
| Session / signup tuning | `config.thaliaAuth` (defaults from `ThaliaSecurity.defaultThaliaAuthOptions()`): e.g. `disableSelfRegistration`, `disablePasswordReset`, `disablePasswordChange`, `sessionMaxAgeSeconds` |
| Mail-backed flows | `ThaliaSecurity` constructor `mailAuthPath` pointing at `config/mailAuth.js`. Export **`from`** (mailbox the SMTP account may send as) plus `transport` or Gmail `mailAuth`. Without `from`, Nodemailer uses `MAIL FROM:<>` and hosted SMTP may reject the message as a bounce. Per-message `from` still overrides the file default. |
| Login throttle | Default on auth POSTs: **5** attempts per client IP per action in **15 minutes** → **6 hour** ban (`auth_login_throttles`). Actions: `logon` (failed passwords only), `forgotPassword` / `resetPassword` / `setup` / `createNewUser` (every POST). Keyed by IP+action so attackers cannot lock a victim account. Signed-in users see a clearer message; guests get a short one. Schema is in `securityConfig()` — migrate / `drizzle-kit push` after upgrading. Sliding-window math is shared with `IpRateLimiter` in `thalia/util` (also re-exported from `thalia/security`). |
| Public form / API rate limit | Use **`IpRateLimiter`** from `thalia/util` (or `thalia/security`) in your **controller** — module-scoped instance + `check(requestInfo.ip)`. Example: UBC `contactUbcController`. Not wired into `RoleRouteGuard` (RBAC only); auth lockouts stay in `login-throttle`. |
| Types | Import `RoleRouteRule` from `thalia/security` (re-exported from `server/route-guard.ts`) |

## Public API surface

Import from **`thalia/security`** (`server/security/index.ts`): `ThaliaSecurity`, `SecurityService`, `ProfileControllerFactory`, `claimAdminNamespace`, session helpers, and `RoleRouteRule` types. Implementation files under `server/security/` are split for maintenance; the barrel is the supported import path for apps.

## Related files

- `server/route-guard.ts` — `RoleRouteGuard`, `Permission`, `UserAuth`, route loading.
- `server/request-handler.ts` — handler chain order.
- `server/server.ts` — `RequestInfo` (including `action` from the URL).
- `server/controllers.ts` — `CrudFactory.getAction`.
- `server/security/thalia-security.ts` — `securityConfig()` and auth controllers.
- `server/security/session-revoke.ts` — soft-revoke helpers (`logged_out = true`; never hard-DELETE sessions).
- `server/security/profile-password.ts` — authenticated `POST /api/profile/password`.
- `server/security/same-origin.ts` — `assertSameOriginMutation` for cookie mutations.
- `server/security/security-default-routes.ts` — default `RoleRouteRule`s for admin tooling.
- `server/security/claim-admin-namespace.ts` — `claimAdminNamespace` for explicit `/admin` takeover.
