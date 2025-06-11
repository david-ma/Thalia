import { Model, InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from '@sequelize/core';
export declare class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    id: CreationOptional<number>;
    name: string;
    email: string;
    password: string;
    photo: CreationOptional<string>;
    role: CreationOptional<string>;
    locked: CreationOptional<boolean>;
    verified: CreationOptional<boolean>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    isAdmin(): boolean;
    getSessions(): Promise<Session[]>;
    logout(sessionId: string): Promise<number>;
}
export declare function UserFactory(sequelize: Sequelize): typeof User;
export declare class Session extends Model<InferAttributes<Session>, InferCreationAttributes<Session>> {
    sid: string;
    expires: Date;
    data: CreationOptional<Record<string, any>>;
    userId: CreationOptional<number>;
    loggedOut: CreationOptional<boolean>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
    getUser(): Promise<User | null>;
}
export declare function SessionFactory(sequelize: Sequelize): typeof Session;
export declare class Audit extends Model<InferAttributes<Audit>, InferCreationAttributes<Audit>> {
    id: CreationOptional<number>;
    userId: CreationOptional<number>;
    ip: string;
    sessionId: CreationOptional<string>;
    action: string;
    blob: CreationOptional<Record<string, any>>;
    timestamp: CreationOptional<Date>;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}
export declare function AuditFactory(sequelize: Sequelize): typeof Audit;
//# sourceMappingURL=security.d.ts.map