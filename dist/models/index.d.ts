import { UserFactory, SessionFactory, AuditFactory, User, Session, Audit } from './security';
import { AlbumFactory, ImageFactory } from './smugmug';
import { SeqObject, SecurityObject } from './types';
export type { SeqObject, SecurityObject };
export type { User, Session, Audit };
export interface DatabaseConfig {
    dialect: 'mariadb';
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    logging?: false | ((sql: string, timing?: number) => void);
    pool?: {
        max?: number;
        min?: number;
        acquire?: number;
        idle?: number;
    };
}
export declare function securityFactory(config: DatabaseConfig): SeqObject;
export declare function smugmugFactory(config: DatabaseConfig): SeqObject;
export { UserFactory, SessionFactory, AuditFactory };
export { AlbumFactory, ImageFactory };
export * from './security';
