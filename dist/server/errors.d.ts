/**
 * Custom Error Classes for Thalia Framework
 *
 * Provides typed error classes for better error handling and debugging.
 * All errors extend ThaliaError which provides a consistent error interface.
 */
/**
 * Base error class for all Thalia errors
 */
export declare class ThaliaError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown>;
    constructor(message: string, code: string, context?: Record<string, unknown>);
    /**
     * Convert error to a plain object for logging/API responses
     */
    toJSON(): Record<string, unknown>;
}
/**
 * Configuration-related errors
 * Thrown when website configuration is invalid or missing
 */
export declare class ConfigurationError extends ThaliaError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Database-related errors
 * Thrown when database operations fail
 */
export declare class DatabaseError extends ThaliaError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Routing-related errors
 * Thrown when route matching or handling fails
 */
export declare class RoutingError extends ThaliaError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Template-related errors
 * Thrown when Handlebars template compilation or rendering fails
 */
export declare class TemplateError extends ThaliaError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Request handling errors
 * Thrown when request processing fails
 */
export declare class RequestError extends ThaliaError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Security-related errors
 * Thrown when authentication or authorization fails
 */
export declare class SecurityError extends ThaliaError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * File system errors
 * Thrown when file operations fail
 */
export declare class FileSystemError extends ThaliaError {
    constructor(message: string, context?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map