import { Thalia } from './thalia';
import { Views } from './requestHandlers';
export type SecurityMiddleware = (controller: Thalia.Controller, success: ([views, user]: [Views, User]) => void, failure?: () => void) => Promise<void>;
declare function crud(options: {
    tableName: string;
    references?: string[];
    hideColumns?: string[];
    security?: SecurityMiddleware;
}): {
    [x: string]: (controller: Thalia.Controller) => void;
};
export declare function setHandlebarsContent(content: string): Promise<void>;
export declare function loadViewsAsPartials(views: Views): void;
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
export declare function createSession(userId: number, controller: Thalia.Controller, noCookie?: boolean): Promise<any>;
declare function inviteNewAdmin(email: string, controller: Thalia.Controller, mailAuth: any): Promise<any>;
export declare const checkSession: SecurityMiddleware;
declare const _default: {
    crud: typeof crud;
    inviteNewAdmin: typeof inviteNewAdmin;
};
export default _default;
export { crud, Views, inviteNewAdmin, Session, User, Audit };
