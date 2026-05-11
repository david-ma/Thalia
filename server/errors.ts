/**
 * Custom Error Classes for Thalia Framework
 *
 * Provides typed error classes for better error handling and debugging.
 * All errors extend ThaliaError which provides a consistent error interface.
 */

/**
 * Base error class for all Thalia errors
 */
export class ThaliaError extends Error {
  public readonly code: string
  public readonly context?: Record<string, unknown>

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.context = context

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Convert error to a plain object for logging/API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    }
  }
}

/**
 * Configuration-related errors
 * Thrown when website configuration is invalid or missing
 */
export class ConfigurationError extends ThaliaError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context)
  }
}

/**
 * Database-related errors
 * Thrown when database operations fail
 */
export class DatabaseError extends ThaliaError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', context)
  }
}

/**
 * Routing-related errors
 * Thrown when route matching or handling fails
 */
export class RoutingError extends ThaliaError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ROUTING_ERROR', context)
  }
}

/**
 * Template-related errors
 * Thrown when Handlebars template compilation or rendering fails
 */
export class TemplateError extends ThaliaError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TEMPLATE_ERROR', context)
  }
}

/**
 * Request handling errors
 * Thrown when request processing fails
 */
export class RequestError extends ThaliaError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'REQUEST_ERROR', context)
  }
}

/**
 * Security-related errors
 * Thrown when authentication or authorization fails
 */
export class SecurityError extends ThaliaError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', context)
  }
}

/**
 * File system errors
 * Thrown when file operations fail
 */
export class FileSystemError extends ThaliaError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'FILE_SYSTEM_ERROR', context)
  }
}
