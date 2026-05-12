import type { Permission, RoleRouteRule } from '../route-guard.js'

export const ALL_PERMISSIONS: Permission[] = ['create', 'read', 'update', 'delete']

export const default_routes: RoleRouteRule[] = [
  {
    path: '/admin',
    permissions: {
      admin: ALL_PERMISSIONS,
    },
  },
  {
    /** Aligns with the `users` CRUD controller path (`/users/...`). */
    path: '/users',
    permissions: {
      admin: ALL_PERMISSIONS,
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
