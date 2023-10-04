import { Thalia } from './thalia';
export type SecurityMiddleware = (controller: Thalia.Controller, success: ([Views, UserModel]: [any, any]) => void, failure?: () => void) => Promise<void>;
declare function crud(options: {
    tableName: string;
    references?: string[];
    hideColumns?: string[];
    security?: SecurityMiddleware;
}): {
    [x: string]: (controller: Thalia.Controller) => void;
};
import { Model, Sequelize } from 'sequelize';
interface seqObject {
    [key: string]: typeof Model | Sequelize;
    sequelize: Sequelize;
}
import { UserFactory, SessionFactory, AuditFactory, User, SessionModel } from '../websites/example/models/security';
import { securityFactory } from '../websites/example/models';
export { securityFactory, seqObject };
declare function createSession(userId: number, controller: any, noCookie?: boolean): Promise<any>;
declare function inviteNewAdmin(email: string, controller: Thalia.Controller, mailAuth: any): Promise<any>;
declare const _default: {
    crud: typeof crud;
    UserFactory: typeof UserFactory;
    SessionFactory: typeof SessionFactory;
    AuditFactory: typeof AuditFactory;
    createSession: typeof createSession;
    inviteNewAdmin: typeof inviteNewAdmin;
};
export default _default;
export { crud, UserFactory, SessionFactory, AuditFactory, createSession, inviteNewAdmin, SessionModel, User };
