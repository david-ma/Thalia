import { Thalia } from './types';
/**
 * Creates a new session for a user
 */
export declare function createSession(userId: number, controller: Thalia.Controller, noCookie?: boolean): Promise<void>;
