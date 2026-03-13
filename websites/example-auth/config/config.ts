import { fruit } from '../models/fruit.js';
import { CrudFactory } from 'thalia/controllers';
import { ThaliaSecurity } from 'thalia/security';
import { recursiveObjectMerge } from 'thalia/website';
import type { ServerResponse, IncomingMessage } from 'http';
import type { RequestInfo } from 'thalia/server';
import type { Website } from 'thalia/website';
import { eq } from 'drizzle-orm';

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
import path from 'path';
const mailAuthPath = path.join(import.meta.dirname, 'mailAuth.js');
const security = new ThaliaSecurity({
    mailAuthPath,
});

/** Profile controller: view any profile when logged in; edit only owner or admin. */
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
            .then((rows) => {
                const user = rows[0];
                if (!user) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/html');
                    res.end('<h1>Not Found</h1><p>Profile not found.</p>');
                    return;
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html');
                res.end(
                    `<h1>Profile</h1><p>ID: ${user.id}</p><p>Name: ${user.name ?? ''}</p><p>Role: ${user.role ?? ''}</p>`,
                );
            })
            .catch((err) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/html');
                res.end('<h1>Error</h1><p>' + (err as Error).message + '</p>');
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
            const updates: Record<string, unknown> = {};
            if (typeof data.name === 'string') updates.name = data.name;
            if (Object.keys(updates).length === 0) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, id }));
                return;
            }
            website.db.drizzle
                .update(usersTable)
                .set(updates as any)
                .where(eq(usersTable.id, id))
                .then(() => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ ok: true, id }));
                })
                .catch((err) => {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: (err as Error).message }));
                });
        });
        return;
    }
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h1>Method Not Allowed</h1>');
}

const roleBasedSecurityConfig = recursiveObjectMerge(recursiveObjectMerge(security.securityConfig(), fruitConfig), {
    routes: [
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
            },
        },
        {
            path: '/',
            permissions: {
                admin: ['read'],
                user: ['read'],
            },
        },
    ],
    controllers: {
        profile: profileController,
    },
});
import { albums, images } from '../models/drizzle-schema'
import { CrudFactory, SmugMugUploader } from '../../../server/controllers'

const AlbumMachine = new CrudFactory(albums as any)
const ImageMachine = new CrudFactory(images as any)
const smugMugUploader = new SmugMugUploader()
const smugmugConfig = {
    controllers: {
        smugmugAlbums: AlbumMachine.controller.bind(AlbumMachine),
        smugmugImages: ImageMachine.controller.bind(ImageMachine),
        uploadPhoto: smugMugUploader.controller.bind(smugMugUploader),
    },
    database: {
        schemas: {
            albums,
            images,
        },
        machines: {
            albums: AlbumMachine,
            images: ImageMachine,
            smugmug: smugMugUploader,
        },
    },
};
export const config = recursiveObjectMerge(roleBasedSecurityConfig, smugmugConfig);
//# sourceMappingURL=config.js.map