import { ServerResponse, IncomingMessage } from 'http'
import { Website } from './website.js'
import { CrudFactory, Machine } from './controllers.js'

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

import { Permission, Role, SecurityConfig } from './route-guard.js'
export type { SecurityConfig }

import { users, sessions, audits } from '../models/security-models.js'
import { RawWebsiteConfig, RouteRule } from './types.js'

const UserMachine: Machine = new CrudFactory(users, {
  relationships: [
    {
      foreignTable: 'sessions',
      foreignColumn: 'userId',
      localColumn: 'id',
    },
  ],
})

const SessionMachine: Machine = new CrudFactory(sessions, {
  relationships: [
    {
      foreignTable: 'users',
      foreignColumn: 'id',
      localColumn: 'userId',
    },
  ],
})

const AuditMachine: Machine = new CrudFactory(audits, {
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
})

export interface RoleRouteRule extends RouteRule {
  path: string
  permissions: Partial<Record<Role, Permission[]>>
  // For user-specific permissions
  // ownerOnly?: string[] // Actions only the owner can perform
  // Hardcode "owner: userId" to objects that can be owned?
}

const ALL_PERMISSIONS: Permission[] = ['create', 'read', 'update', 'delete']
const ALL_ROLES: Role[] = ['admin', 'user', 'guest']
// special role, "owner" is used for user-specific permissions

const default_routes: RoleRouteRule[] = [
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
]

export const securityConfig: RawWebsiteConfig = {
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
}
