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
const ALL_PERMISSIONS = ['view', 'edit', 'delete', 'create'];
const ALL_ROLES = ['admin', 'user', 'guest'];
// special role, "owner" is used for user-specific permissions
const default_routes = [
    {
        path: '/',
        permissions: {
            'guest': ALL_PERMISSIONS,
        },
    },
    {
        path: '/admin',
        permissions: {
            'admin': ALL_PERMISSIONS,
        }
    },
    {
        path: '/user',
        permissions: {
            'admin': ALL_PERMISSIONS,
            'owner': ['view', 'edit', 'delete'],
            'user': ['view'],
        }
    },
    {
        path: '/sessions',
        permissions: {
            'admin': ALL_PERMISSIONS,
        }
    },
    {
        path: '/audits',
        permissions: {
            'admin': ALL_PERMISSIONS,
        }
    }
];
export const securityConfig = {
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
    },
    routes: default_routes,
};
//# sourceMappingURL=security.js.map