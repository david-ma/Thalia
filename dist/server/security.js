import { CrudFactory } from './controllers.js';
import { users, sessions, audits } from '../models/security-models.js';
const UserMachine = new CrudFactory(users, {
    relationships: [
        {
            foreignTable: 'sessions',
            foreignColumn: 'userId',
            localColumn: 'id',
        },
    ],
});
const SessionMachine = new CrudFactory(sessions, {
    relationships: [
        {
            foreignTable: 'users',
            foreignColumn: 'id',
            localColumn: 'userId',
        },
    ],
});
const AuditMachine = new CrudFactory(audits, {
    relationships: [
        {
            foreignTable: 'users',
            foreignColumn: 'id',
            localColumn: 'userId',
        },
        {
            foreignTable: 'sessions',
            foreignColumn: 'sid',
            localColumn: 'sessionId',
        },
    ],
});
const ALL_PERMISSIONS = ['create', 'read', 'update', 'delete'];
const ALL_ROLES = ['admin', 'user', 'guest'];
// special role, "owner" is used for user-specific permissions
const default_routes = [
    {
        path: '/',
        permissions: {
            guest: ALL_PERMISSIONS,
        },
    },
    {
        path: '/admin',
        permissions: {
            admin: ALL_PERMISSIONS,
        },
    },
    {
        path: '/user',
        permissions: {
            admin: ALL_PERMISSIONS,
            // owner: ['view', 'edit', 'delete'],
            user: ['read'],
        },
    },
    {
        path: '/sessions',
        permissions: {
            admin: ALL_PERMISSIONS,
        },
    },
    {
        path: '/audits',
        permissions: {
            admin: ALL_PERMISSIONS,
        },
    },
];
import { parseForm } from './controllers.js';
import { eq } from 'drizzle-orm';
export class ThaliaSecurity {
}
ThaliaSecurity.securityConfig = {
    database: {
        schemas: {
            users,
            sessions,
            audits,
        },
        machines: {
            users: UserMachine,
            sessions: SessionMachine,
            audits: AuditMachine,
        },
    },
    controllers: {
        users: UserMachine.controller.bind(UserMachine),
        sessions: SessionMachine.controller.bind(SessionMachine),
        audits: AuditMachine.controller.bind(AuditMachine),
        logon: (res, req, website, requestInfo) => {
            const method = requestInfo.method;
            if (method === 'GET') {
                res.end(website.getContentHtml('userLogin')({}));
            }
            else if (method === 'POST') {
                parseForm(res, req).then((form) => {
                    console.log('Login attempt:', form);
                    // TODO: Implement logon
                    res.end(website.getContentHtml('userLogin')({}));
                });
            }
            else {
                res.end('Method not allowed');
            }
        },
        admin: (res, req, website, requestInfo) => {
            res.end(website.getContentHtml('admin')({ requestInfo }));
        },
        forgotPassword: (res, req, website, requestInfo) => {
            const method = requestInfo.method;
            if (method === 'GET') {
                res.end(website.getContentHtml('forgotPassword')({}));
            }
            else if (method === 'POST') {
                parseForm(res, req).then((form) => {
                    console.log('We have a post!');
                    console.log('Form', form);
                    // Send an email to the user with a link to reset their password
                    if (!form.fields.email) {
                        res.end(website.getContentHtml('forgotPassword')({ error: 'Email is required' }));
                        return;
                    }
                    const mailService = website.db.machines.mail;
                    if (!mailService) {
                        res.end(website.getContentHtml('forgotPassword')({ error: 'Mail service not found' }));
                        return;
                    }
                    console.log('Mail service', mailService);
                    mailService.sendEmail({
                        to: form.fields.email,
                        subject: 'Reset your password',
                        text: 'Reset your password',
                        html: 'Reset your password',
                    });
                    const user = website.db.machines.users.table;
                    const drizzle = website.db.drizzle;
                    drizzle
                        .select()
                        .from(user)
                        .where(eq(user.email, form.fields.email))
                        .then(([user]) => {
                        if (!user) {
                            // Don't tell the user that the email is not found, just say it's been sent
                            res.end(website.getContentHtml('forgotPassword')({ error: 'Email sent' }));
                            return;
                        }
                        // Send an email to the user with a link to reset their password
                        // TODO: Implement this
                        console.log('Sending email to', user.email);
                        res.end(website.getContentHtml('forgotPassword')({ error: 'Email sent' }));
                    });
                });
            }
            else {
                res.end('Method not allowed');
            }
        },
        newUser: (res, req, website, requestInfo) => {
            res.end(website.getContentHtml('newUser')({}));
        },
    },
    routes: default_routes,
};
//# sourceMappingURL=security.js.map