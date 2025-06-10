"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = void 0;
/**
 * Creates a new session for a user
 */
async function createSession(userId, controller, noCookie) {
    const session = {
        userId,
        createdAt: new Date()
    };
    if (!noCookie) {
        controller.setCookie('session', JSON.stringify(session), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    }
    controller.req.session = session;
}
exports.createSession = createSession;
//# sourceMappingURL=session.js.map