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
export { authLoginNavFlags, withAuthLoginNavFlags, sendAuthHtml } from './auth-response-helpers.js'
export type { LoginThrottleRepository, LoginThrottleState } from './login-throttle.js'
export {
  MAX_BAD_PASSWORD_ATTEMPTS,
  BAD_PASSWORD_WINDOW_MS,
  TEMPORARY_LOCK_MS,
  DUMMY_PASSWORD_HASH,
  normaliseLoginIdentity,
  loginThrottleKeyHash,
  pruneFailureTimestamps,
  isTemporarilyLocked,
  nextFailureState,
  createDrizzleLoginThrottleRepository,
  createMemoryLoginThrottleRepository,
  loginThrottleRepositoryForWebsite,
} from './login-throttle.js'
export type {
  ProfileControllerFactoryOptions,
  ProfileEmailVisibility,
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
  profileRevealEmailForGet,
  profileSelfRedirectLocation,
  validateProfilePhotoHttpHttpsUrl,
} from './profile-controller-factory.js'
