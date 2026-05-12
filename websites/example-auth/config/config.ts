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
 * keep enforcing them inside the controller (see **`profileController`** below).
 *
 * ### `config.thaliaAuth`
 *
 * Populated by `ThaliaSecurity.defaultThaliaAuthOptions()`. Tune via **`new ThaliaSecurity({ … })`**:
 * **`mailAuthPath`**, **`disableSelfRegistration`**, **`sessionMaxAgeSeconds`**, etc.
 */
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { eq } from 'drizzle-orm';
import { CrudFactory, ThaliaImageUploader } from 'thalia/controllers';
import type { RequestInfo } from 'thalia/server';
import type { User } from 'thalia/models';
import { type RoleRouteRule, ThaliaSecurity } from 'thalia/security';
import { recursiveObjectMerge } from 'thalia/website';
import type { Website } from 'thalia/website';
import { fruit } from '../models/fruit.js';
import { albums, images } from '../models/drizzle-schema';

/** Public fields returned by the profile GET handler (subset of `User`). */
type ProfileRow = Pick<User, 'id' | 'name' | 'email' | 'photo' | 'role'>;

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

/**
 * Profile controller: route guard already requires a signed-in **user** or **admin** for `read`/`update`
 * on `/profile`. Here we add **row-level** rules (only owner or admin may update).
 */
function profileController(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
) {
    const userIdParam = requestInfo.action || '';
    const id = parseInt(userIdParam, 10);
    const userAuth = requestInfo.userAuth;
    if (!website.db) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/html');
        res.end('<h1>Service Unavailable</h1><p>Database not configured.</p>');
        return;
    }
    const usersTable = website.db.machines.users.table;
    if (req.method === 'GET') {
        if (!Number.isFinite(id)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/html');
            res.end('<h1>Bad Request</h1><p>Profile ID required.</p>');
            return;
        }
        website.db.drizzle
            .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, photo: usersTable.photo, role: usersTable.role })
            .from(usersTable)
            .where(eq(usersTable.id, id))
            .limit(1)
            .then((rows: ProfileRow[]) => {
                const user = rows[0];
                if (!user) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/html');
                    res.end('<h1>Not Found</h1><p>Profile not found.</p>');
                    return;
                }
                const isOwner =
                    userAuth?.userId !== undefined && String(userAuth.userId) === String(user.id);
                const isAdmin = userAuth?.role === 'admin';
                const canEdit = isOwner || isAdmin;
                const profileName = user.name ?? '';
                const profileEmail = user.email ?? '';
                const profilePhoto = (user.photo && String(user.photo).trim()) || '';
                const profileInitialRaw =
                    (profileName.trim()[0] ?? '') ||
                    (profileEmail.trim()[0] ?? '') ||
                    '?';
                const profileInitial = profileInitialRaw.toUpperCase();
                const profileDisplayName =
                    profileName.trim() || profileEmail || `User ${user.id}`;
                const profileRole = user.role ?? 'user';
                const html = website.getContentHtml('profile_content')({
                    title: `Profile — ${profileDisplayName}`,
                    description: `Account profile for ${profileDisplayName} on Example Auth.`,
                    profileId: user.id,
                    profileName,
                    profileDisplayName,
                    profileEmail,
                    profileRole,
                    profilePhoto,
                    profileInitial,
                    canEdit,
                    isOwnProfile: isOwner,
                    viewerIsAdmin: !!isAdmin,
                });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(html);
            })
            .catch((err: unknown) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/html');
                const msg = err instanceof Error ? err.message : String(err);
                res.end('<h1>Error</h1><p>' + msg + '</p>');
            });
        return;
    }
    if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') {
        if (!Number.isFinite(id)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Profile ID required' }));
            return;
        }
        const isOwner = userAuth?.userId !== undefined && String(userAuth.userId) === String(id);
        const isAdmin = userAuth?.role === 'admin';
        if (!isOwner && !isAdmin) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Forbidden: only owner or admin can edit this profile' }));
            return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            let data: { name?: string } = {};
            try {
                data = body ? JSON.parse(body) : {};
            } catch {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
            if (typeof data.name !== 'string') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, id }));
                return;
            }
            website.db.drizzle
                .update(usersTable)
                .set({ name: data.name })
                .where(eq(usersTable.id, id))
                .then(() => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true, id }));
                })
                .catch((err: unknown) => {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    const msg = err instanceof Error ? err.message : String(err);
                    res.end(JSON.stringify({ error: msg }));
                });
        });
        return;
    }
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>Method Not Allowed</h1>');
}

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
        profile: profileController,
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
