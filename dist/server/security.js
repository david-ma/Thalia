import { CrudFactory } from './controllers.js';
/*
This is the Thalia role based security system.

Thalia will have a few different levels of RouteGuard.
With zero config provided, it won't do any route guarding at all and just let all requests through.
At BasicRouteGuard, it can take a hard-coded password, simple path, and/or proxy target. And it is happy to take any mix of these.

This file is for the role based security system.
We will provide a simple interface that webmasters can import into their config.ts file.

This will then import the 3 required models: Users, Sessions, and Audits.
Roles are hardcoded to just admin, user, and guest.

When activating this module we also provide controllers which will handle the CRUD operations for the 3 models.
And set the permissions on these models based on the role of the user.

Our schema will be modelled on django security, for easy migration.

*/
import { MailService, mailTable } from './mail.js';
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
import crypto from 'crypto';
export class ThaliaSecurity {
    constructor(options = {
    // mailAuthPath: path.join(import.meta.dirname, '..',)
    }) {
        this.salt = 'wXMGCAwPhG7rk82pSM0captn16BXbMqw';
        console.log('ThaliaSecurity constructor');
        this.salt = options.salt || this.salt;
        console.log('import.meta.dirname', import.meta.dirname);
        this.mailService = new MailService(options.mailAuthPath ?? '');
    }
    init(website, db, sqlite, name) {
        this.website = website;
        this.mailService.init(website, db, sqlite, 'mail');
    }
    controller(res, req, website, requestInfo) {
        console.log('ThaliaSecurity controller');
    }
    hashPassword(password) {
        return crypto
            .createHash('sha256')
            .update(password + this.salt)
            .digest('hex');
    }
    logonController(res, req, website, requestInfo) {
        const security = website.db.machines.security;
        const drizzle = website.db.drizzle;
        const usersTable = website.db.machines.users.table;
        const method = requestInfo.method;
        if (method === 'GET') {
            res.end(website.getContentHtml('userLogin')({}));
        }
        else if (method === 'POST') {
            parseForm(res, req).then((form) => {
                console.log('Login attempt:', form);
                if (!form.fields.Email || !form.fields.Password) {
                    console.log('Email and password are required');
                    res.end(website.getContentHtml('userLogin')({ error: 'Email and password are required' }));
                    return;
                }
                const password = security.hashPassword(form.fields.password);
                drizzle
                    .select()
                    .from(usersTable)
                    .where(eq(usersTable.email, form.fields.Email))
                    .then(([user]) => {
                    console.log('Found User', user);
                    if (!user) {
                        res.end(website.getContentHtml('userLogin')({ error: 'Invalid email or password' }));
                        return;
                    }
                    if (user.password !== password) {
                        res.end(website.getContentHtml('userLogin')({ error: 'Invalid email or password' }));
                        return;
                    }
                    if (user.isActive === false) {
                        res.end(website.getContentHtml('userLogin')({ error: 'Account is locked' }));
                        return;
                    }
                    // if (user.isVerified === false) {
                    //   res.end(website.getContentHtml('userLogin')({ error: 'Account is not verified' }))
                    //   return
                    // }
                    return user;
                }, (error) => {
                    console.error('Error logging in:', error);
                    res.end(website.getContentHtml('userLogin')({ error: 'An error occurred' }));
                    throw error;
                })
                    .then((user) => {
                    if (!user) {
                        res.end(website.getContentHtml('userLogin')({ error: 'Invalid email or password' }));
                        return;
                    }
                    console.log('We have a user', user);
                    console.log('Generating a session');
                    // Generate a session
                    const session = website.db.machines.sessions.table;
                    const sessionId = crypto.randomBytes(16).toString('hex');
                    website.db.drizzle
                        .insert(session)
                        .values({
                        sid: sessionId,
                        userId: user.id,
                    })
                        .then((data) => {
                        this.setCookie(res, sessionId);
                        res.end(website.getContentHtml('userLogin')({ message: 'Login successful' }));
                    });
                    // TODO: Implement logon
                    // res.end(website.getContentHtml('userLogin')({}))
                });
            });
        }
        else {
            res.end('Method not allowed');
        }
    }
    // private getUserFromSession(sessionId: string): Promise<User> {
    //   const session = this.website.db.machines.sessions.table
    //   const drizzle = this.website.db.drizzle
    //   const user = this.website.db.machines.users.table
    //   return drizzle.select().from(user).where(eq(session.sid, sessionId)).then(([user]) => user)
    // }
    setCookie(res, sessionId) {
        if (res.headersSent) {
            console.log('Headers already sent');
            return;
        }
        res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict`);
    }
    forgotPasswordController(res, req, website, requestInfo) {
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
    }
    securityConfig() {
        return {
            database: {
                schemas: {
                    users,
                    sessions,
                    audits,
                    mail: mailTable,
                },
                machines: {
                    users: UserMachine,
                    sessions: SessionMachine,
                    audits: AuditMachine,
                    mail: this.mailService,
                    security: this,
                },
            },
            controllers: {
                users: UserMachine.controller.bind(UserMachine),
                sessions: SessionMachine.controller.bind(SessionMachine),
                audits: AuditMachine.controller.bind(AuditMachine),
                admin: (res, req, website, requestInfo) => {
                    res.end(website.getContentHtml('admin')({ requestInfo }));
                },
                mail: this.mailService.controller.bind(this.mailService),
                logon: this.logonController.bind(this),
                forgotPassword: this.forgotPasswordController.bind(this),
                newUser: (res, req, website, requestInfo) => {
                    res.end(website.getContentHtml('newUser')({}));
                },
            },
            routes: default_routes,
        };
    }
}
//# sourceMappingURL=security.js.map