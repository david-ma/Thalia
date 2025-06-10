import formidable from 'formidable';
/**
 * Deep merges two objects, similar to lodash's merge
 */
export declare function merge<T extends object>(target: T, source: object): T;
/**
 * Escapes HTML special characters in a string
 */
export declare function htmlEscape(string: string): string;
/**
 * Escapes OAuth special characters in a string
 */
export declare function oauthEscape(string: string): string;
/**
 * Sorts object parameters alphabetically by key
 */
export declare function sortParams(object: object): object;
/**
 * Parses form data from a request
 */
export declare function parseForm(controller: any): Promise<[Record<string, string>, formidable.Files<string>]>;
/**
 * Parses a boolean string value
 */
export declare function parseBoolean(string: string): boolean;
