import { Thalia } from './thalia';
import { Views } from './requestHandlers';
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
import { User, Session, Audit } from '../websites/example/models/security';
import { Album, Image } from '../websites/example/models/smugmug';
export { Album, Image };
import { securityFactory, smugmugFactory } from '../websites/example/models';
export { securityFactory, smugmugFactory, seqObject };
declare function createSession(userId: number, controller: any, noCookie?: boolean): Promise<any>;
declare function inviteNewAdmin(email: string, controller: Thalia.Controller, mailAuth: any): Promise<any>;
declare const _default: {
    crud: typeof crud;
    createSession: typeof createSession;
    inviteNewAdmin: typeof inviteNewAdmin;
};
export default _default;
export { crud, Views, createSession, inviteNewAdmin, Session, User, Audit };
