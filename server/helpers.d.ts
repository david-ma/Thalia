import { ModelStatic, Sequelize } from 'sequelize';
import { Thalia } from './thalia';
export { Thalia };
import { Views } from './requestHandlers';
export type SecurityMiddleware = (controller: Thalia.Controller, success: ([views, user]: [Views, User]) => void, failure?: () => void) => Promise<void>;
export declare function showWebpage(name: string, options?: {
    wrapper?: string;
    variables?: object;
}): (router: Thalia.Controller) => void;
declare function crud(options: {
    tableName: string;
    references?: string[];
    hideColumns?: string[];
    security?: SecurityMiddleware;
}): {
    [x: string]: (controller: Thalia.Controller) => void;
};
export declare function setHandlebarsContent(content: string, Handlebars: any): Promise<any>;
export declare function loadViewsAsPartials(views: Views, Handlebars: any): void;
type SeqObject = {
    sequelize: Sequelize;
} & Omit<{
    [key: string]: ModelStatic<any>;
}, 'sequelize'>;
type seqObject = SeqObject;
import { User, Session, Audit } from '../websites/example/models/security';
export { Album, Image, AlbumStatic, ImageStatic, } from '../websites/example/models/smugmug';
import { securityFactory, smugmugFactory } from '../websites/example/models';
export { securityFactory, smugmugFactory, SeqObject, seqObject };
export declare function createSession(userId: number, controller: Thalia.Controller, noCookie?: boolean): Promise<any>;
type emailNewAccountConfig = {
    email: string;
    controller: Thalia.Controller;
    mailAuth: {};
};
export declare function checkEmail(controller: Thalia.Controller): void;
export declare function emailNewAccount(config: emailNewAccountConfig): Promise<any>;
export declare const checkSession: SecurityMiddleware;
export type SecurityOptions = {
    websiteName: string;
    mailFrom?: string;
    mailAuth: {
        user: string;
        pass: string;
    };
};
export declare function users(options: SecurityOptions): {
    profile: (controller: Thalia.Controller) => void;
    login: (controller: Thalia.Controller) => void;
    logon: (controller: Thalia.Controller) => void;
    logout: (controller: Thalia.Controller) => void;
    forgotPassword: (controller: Thalia.Controller) => void;
    recoverAccount: (controller: Thalia.Controller) => void;
    newUser: (controller: Thalia.Controller) => void;
    createNewUser: (controller: Thalia.Controller) => void;
    verifyEmail: (controller: Thalia.Controller) => void;
    invite: (controller: Thalia.Controller) => void;
};
declare const _default: {
    crud: typeof crud;
};
export default _default;
export { crud, Views, Session, User, Audit };
export declare function oauthEscape(string: string): string;
export declare function htmlEscape(string: string): string;
export declare function sortParams(object: object): {};
