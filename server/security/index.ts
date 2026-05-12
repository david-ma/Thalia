/**
 * Thalia role-based security (`ThaliaSecurity`, `RoleRouteGuard`, session cookies, auth HTML).
 * Implementation is split under this directory; this file is the **public barrel** for `thalia/security`.
 */
export type { SecurityConfig, RoleRouteRule } from '../route-guard.js'
export { DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS, sessionMaxAgeSecondsForWebsite } from './session-cookie.js'
export type { UserDetails } from './security-service.js'
export { SecurityService } from './security-service.js'
export type { ThaliaSecurityConstructorOptions } from './thalia-security.js'
export { ThaliaSecurity, SnipeSecurity } from './thalia-security.js'
export type {
  ProfileControllerFactoryOptions,
  ProfileJsonErrorBody,
  ProfileJsonErrorCode,
  ProfilePhotoValidationResult,
  ProfileReadScope,
  ProfileViewModelInput,
} from './profile-controller-factory.js'
export {
  ProfileControllerFactory,
  parseProfileUpdatePayload,
  profileJsonErrorBody,
  profileJsonErrorString,
  profileSelfRedirectLocation,
  validateProfilePhotoHttpHttpsUrl,
} from './profile-controller-factory.js'
