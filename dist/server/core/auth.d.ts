/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
export interface User {
    id: string;
    username: string;
    passwordHash: string;
    email?: string;
}
export interface Session {
    id: string;
    userId: string;
    expires: Date;
}
export declare class AuthHandler {
    private users;
    private sessions;
    private sessionDuration;
    constructor(sessionDuration?: number);
    register(username: string, password: string, email?: string): Promise<User>;
    login(username: string, password: string): Promise<Session>;
    logout(sessionId: string): Promise<void>;
    validateSession(sessionId: string): Promise<User | null>;
    setCookie(res: ServerResponse, sessionId: string): void;
    getSessionFromCookie(req: IncomingMessage): string | null;
    private hashPassword;
}
