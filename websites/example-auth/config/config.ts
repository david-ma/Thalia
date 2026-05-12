/**
 * Reference config for **`ThaliaSecurity`** (`server/security/index.ts`) and **`RoleRouteGuard`**.
 *
 * ### How this file is layered
 *
 * 1. **`security.securityConfig()`** — Drops in users/sessions/audits schemas, mail + audit machines,
 *    login/setup/password-reset controllers, and **default route rules** for `/admin`, `/users`,
 *    `/sessions`, and `/audits` (merged into `config.routes` via `recursiveObjectMerge`).
 * 2. **Optional feature modules** (here: fruit inventory, SmugMug uploads) append their own
 *    schemas, machines, and controllers.
 * 3. **`exampleAuthRoutes` + custom controllers** — Your site-specific paths and coarse RBAC:
 *    who may `read` / `create` / `update` / `delete` per URL prefix (longest matching prefix wins).
 *
 * ### Finer-grained checks
 *
 * Route permissions are coarse (per path + role). For resource-level rules (e.g. “only edit your own row”),
 * keep enforcing them inside the controller (see **`ProfileControllerFactory`** in `thalia/security`).
 * **`GET /profile`** (no id) redirects to **`/profile/<session user id>`** by default; set **`profileIndexRedirect: false`** on the factory to keep a **400** instead.
 *
 * ### `config.thaliaAuth`
 *
 * Populated by `ThaliaSecurity.defaultThaliaAuthOptions()`. Tune via **`new ThaliaSecurity({ … })`**:
 * **`mailAuthPath`**, **`disableSelfRegistration`**, **`sessionMaxAgeSeconds`**, etc.
 */
import path from 'path';
import { CrudFactory, ThaliaImageUploader } from 'thalia/controllers';
import { type RoleRouteRule, ThaliaSecurity, ProfileControllerFactory } from 'thalia/security';
import { recursiveObjectMerge } from 'thalia/website';
import { fruit } from '../models/fruit.js';
import { albums, images } from '../models/drizzle-schema';

const FruitMachine = new CrudFactory(fruit);
const fruitConfig = {
    database: {
        schemas: {
            fruit,
        },
        machines: {
            fruit: FruitMachine,
        },
    },
    controllers: {
        fruit: FruitMachine.controller.bind(FruitMachine),
    },
};

const mailAuthPath = path.join(import.meta.dirname, 'mailAuth.js');

/**
 * Wired into `Website.config.thaliaAuth` after merge. Options map to defaults shown in `server/security/index.ts`
 * (`ThaliaSecurity.defaultThaliaAuthOptions`).
 */
const security = new ThaliaSecurity({
    mailAuthPath,
    // disableSelfRegistration: true, // removes self-serve /newUser + /createNewUser from defaults
    // sessionMaxAgeSeconds: 60 * 60 * 24 * 14,
});

const profileMachine = new ProfileControllerFactory({
    buildPageDescription: (displayName) => `Account profile for ${displayName} on Example Auth.`,
});

/**
 * Path-specific RBAC appended to routes from **`security.securityConfig()`** (`/admin`, `/users`, …).
 * Use `RoleRouteRule` so `path` + `permissions` stay aligned with `server/route-guard.ts`.
 */
const exampleAuthRoutes: RoleRouteRule[] = [
    // --- Auth pages (forms + POST targets Thalia ships with ThaliaSecurity) ---
    { path: '/logon', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },
    { path: '/logout', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
    { path: '/logoff', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
    { path: '/setup', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },
    { path: '/newUser', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
    { path: '/createNewUser', permissions: { guest: ['read', 'create'], user: ['create'], admin: ['create'] } },
    { path: '/forgotPassword', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },
    { path: '/resetPassword', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },

    /** Multipart / JSON SmugMug upload — needs `create` if route guard maps POST to create on this path in future. */
    {
        path: '/uploadPhoto',
        permissions: {
            guest: ['read', 'create'],
            user: ['read', 'create'],
            admin: ['read', 'update', 'delete', 'create'],
        },
    },

    // --- App content: adjust per site; comments show the intent for this demo ---
    {
        path: '/fruit',
        permissions: {
            admin: ['read', 'update', 'delete', 'create'],
            user: ['read'],
            guest: ['read'],
        },
    },
    {
        path: '/profile',
        permissions: {
            admin: ['read', 'update', 'delete', 'create'],
            user: ['read', 'update'],
            // guest omitted → 401/403 handled by RoleRouteGuard before this controller runs
        },
    },
    {
        path: '/',
        permissions: {
            admin: ['read'],
            user: ['read'],
            guest: ['read'],
        },
    },
];

const roleBasedSecurityConfig = recursiveObjectMerge(recursiveObjectMerge(security.securityConfig(), fruitConfig), {
    routes: exampleAuthRoutes,
    controllers: {
        profile: profileMachine.controller,
    },
});

const AlbumMachine = new CrudFactory(albums);
const ImageMachine = new CrudFactory(images);
const imageUploader = new ThaliaImageUploader();
const smugmugConfig = {
    controllers: {
        smugmugAlbums: AlbumMachine.controller.bind(AlbumMachine),
        smugmugImages: ImageMachine.controller.bind(ImageMachine),
        uploadPhoto: imageUploader.controller.bind(imageUploader),
    },
    database: {
        schemas: {
            albums,
            images,
        },
        machines: {
            albums: AlbumMachine,
            images: ImageMachine,
            smugmug: imageUploader,
        },
    },
};

/** Final site config: security + demo modules. */
export const config = recursiveObjectMerge(roleBasedSecurityConfig, smugmugConfig);
