import type { Permission, RoleRouteRule } from '../route-guard.js'

export const ALL_PERMISSIONS: Permission[] = ['create', 'read', 'update', 'delete']

/** Authenticated self-service password change (`POST /api/profile/password`). No guest. */
export const profilePasswordRoute: RoleRouteRule = {
  path: '/api/profile',
  permissions: {
    admin: ['read', 'create', 'update'],
    user: ['read', 'create', 'update'],
  },
}

/** Guest-readable legal/policy pages shipped with `securityConfig()`. */
export const GUEST_READ_ROLES = {
  guest: ['read'] as Permission[],
  user: ['read'] as Permission[],
  admin: ['read'] as Permission[],
}

export const privacyPolicyRoute: RoleRouteRule = {
  path: '/privacy-policy',
  permissions: GUEST_READ_ROLES,
}

export const cookiePolicyRoute: RoleRouteRule = {
  path: '/cookie-policy',
  permissions: GUEST_READ_ROLES,
}

export const termsOfUseRoute: RoleRouteRule = {
  path: '/terms-of-use',
  permissions: GUEST_READ_ROLES,
}

export const default_routes: RoleRouteRule[] = [
  privacyPolicyRoute,
  cookiePolicyRoute,
  termsOfUseRoute,
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
  profilePasswordRoute,
]
