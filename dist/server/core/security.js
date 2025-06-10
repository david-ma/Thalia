"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = exports.checkSession = exports.noSecurity = void 0;
const session_1 = require("./session");
const email_1 = require("./email");
/**
 * No-op security middleware that always succeeds
 */
const noSecurity = async function (controller, success, failure) {
    const views = await new Promise((resolve) => controller.readAllViews(resolve));
    success([views, {}]);
};
exports.noSecurity = noSecurity;
/**
 * Session-based security middleware
 */
const checkSession = async function (controller, success, failure) {
    const views = await new Promise((resolve) => controller.readAllViews(resolve));
    const session = controller.req.session;
    if (session && session.userId) {
        const user = await controller.db.User.findByPk(session.userId);
        if (user) {
            success([views, user]);
            return;
        }
    }
    if (failure) {
        failure();
    }
    else {
        controller.res.writeHead(401);
        controller.res.end('Unauthorized');
    }
};
exports.checkSession = checkSession;
/**
 * Creates a user management system with security middleware
 */
function users(options) {
    return {
        checkSession: exports.checkSession,
        noSecurity: exports.noSecurity,
        checkEmail: email_1.checkEmail,
        emailNewAccount: email_1.emailNewAccount,
        createSession: session_1.createSession
    };
}
exports.users = users;
//# sourceMappingURL=security.js.map