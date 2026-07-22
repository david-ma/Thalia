/**
 * Thalia role-based security (`ThaliaSecurity`, `RoleRouteGuard`, session cookies, auth HTML).
 * Implementation is split under this directory; this file is the **public barrel** for `thalia/security`.
 *
 * Rate limiting: auth lockouts live here (`login-throttle`). For public forms / APIs use
 * `IpRateLimiter` from `thalia/util` (shared sliding-window math). Controllers are the
 * insertion point — `RoleRouteGuard` does RBAC only, not rate limits.
 */
export type { SecurityConfig, RoleRouteRule } from '../route-guard.js'
export { DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS, sessionMaxAgeSecondsForWebsite } from './session-cookie.js'
export type { UserDetails } from './security-service.js'
export { SecurityService } from './security-service.js'
export type { ThaliaSecurityConstructorOptions } from './thalia-security.js'
export { ThaliaSecurity, SnipeSecurity } from './thalia-security.js'
export { authLoginNavFlags, withAuthLoginNavFlags, sendAuthHtml } from './auth-response-helpers.js'
export type { LoginThrottleRepository, LoginThrottleState, AuthThrottleAction } from './login-throttle.js'
export {
  MAX_BAD_PASSWORD_ATTEMPTS,
  BAD_PASSWORD_WINDOW_MS,
  TEMPORARY_LOCK_MS,
  DUMMY_PASSWORD_HASH,
  normaliseLoginIdentity,
  loginThrottleKeyHash,
  authThrottleKeyHash,
  isRequestAuthenticated,
  authRateLimitMessage,
  pruneFailureTimestamps,
  isTemporarilyLocked,
  nextFailureState,
  createDrizzleLoginThrottleRepository,
  createMemoryLoginThrottleRepository,
  loginThrottleRepositoryForWebsite,
  checkAuthThrottleLimited,
  recordAuthThrottleAttempt,
  clearAuthThrottle,
} from './login-throttle.js'
/** Re-export so security consumers discover the util without hunting `thalia/util`. */
export {
  IpRateLimiter,
  pruneSlidingWindowTimestamps,
  recordSlidingWindowHit,
} from '../util/rate-limit.js'
export type { IpRateLimitOptions, IpRateLimitResult } from '../util/rate-limit.js'
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
