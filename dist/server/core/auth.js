"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthHandler = void 0;
const crypto_1 = require("crypto");
class AuthHandler {
    constructor(sessionDuration = 24 * 60 * 60 * 1000) {
        this.users = new Map();
        this.sessions = new Map();
        this.sessionDuration = sessionDuration;
    }
    async register(username, password, email) {
        if (this.users.has(username)) {
            throw new Error('Username already exists');
        }
        const passwordHash = this.hashPassword(password);
        const user = {
            id: (0, crypto_1.randomBytes)(16).toString('hex'),
            username,
            passwordHash,
            email
        };
        this.users.set(username, user);
        return user;
    }
    async login(username, password) {
        const user = this.users.get(username);
        if (!user) {
            throw new Error('Invalid username or password');
        }
        const passwordHash = this.hashPassword(password);
        if (passwordHash !== user.passwordHash) {
            throw new Error('Invalid username or password');
        }
        const session = {
            id: (0, crypto_1.randomBytes)(32).toString('hex'),
            userId: user.id,
            expires: new Date(Date.now() + this.sessionDuration)
        };
        this.sessions.set(session.id, session);
        return session;
    }
    async logout(sessionId) {
        this.sessions.delete(sessionId);
    }
    async validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        if (session.expires < new Date()) {
            this.sessions.delete(sessionId);
            return null;
        }
        const user = Array.from(this.users.values()).find(u => u.id === session.userId);
        return user || null;
    }
    setCookie(res, sessionId) {
        res.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; Path=/; Max-Age=${this.sessionDuration / 1000}`);
    }
    getSessionFromCookie(req) {
        const cookies = req.headers.cookie?.split(';').map(c => c.trim());
        const sessionCookie = cookies?.find(c => c.startsWith('session='));
        return sessionCookie ? sessionCookie.split('=')[1] : null;
    }
    hashPassword(password) {
        return (0, crypto_1.createHash)('sha256').update(password).digest('hex');
    }
}
exports.AuthHandler = AuthHandler;
//# sourceMappingURL=auth.js.map