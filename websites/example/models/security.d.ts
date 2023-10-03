import { Sequelize } from 'sequelize';
import { BuildOptions, Model, InferAttributes, InferCreationAttributes } from 'sequelize';
export interface UserAttributes {
    name: string;
    email: string;
    password: string;
    photo: string;
}
export declare class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    id: number;
    name: string;
    email: string;
    password: string;
    photo: string;
}
export type UserStatic = typeof Model & {
    new (values?: object, options?: BuildOptions): User;
};
export declare function UserFactory(sequelize: Sequelize): UserStatic;
export interface SessionAttributes {
    sid: string;
    expires: Date;
    data: Object;
    userId: number;
    loggedOut: boolean;
}
export interface SessionModel extends Model<SessionAttributes>, SessionAttributes {
}
export declare class Session extends Model<SessionModel, SessionAttributes> {
}
export type SessionStatic = typeof Model & {
    new (values?: object, options?: BuildOptions): SessionModel;
};
export declare function SessionFactory(sequelize: Sequelize): SessionStatic;
export interface AuditAttributes {
    id: number;
    userId: number;
    sessionId: string;
    action: string;
    blob: object;
    timestamp: Date;
}
export interface AuditModel extends Model<AuditAttributes>, AuditAttributes {
}
export declare class Audit extends Model<AuditModel, AuditAttributes> {
}
export type AuditStatic = typeof Model & {
    new (values?: object, options?: BuildOptions): AuditModel;
};
export declare function AuditFactory(sequelize: Sequelize): AuditStatic;
