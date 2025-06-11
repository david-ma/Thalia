import { AlbumFactory, ImageFactory } from './smugmug';
import { SeqObject } from './types';
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
export * from './security';
export interface SmugmugConfig {
    dialect: 'sqlite3';
    storage: string;
    logging?: false | ((sql: string, timing?: number) => void);
    pool?: {
        max?: number;
        min?: number;
        acquire?: number;
        idle?: number;
    };
}
export interface SmugmugObject extends SeqObject {
    Album: typeof AlbumFactory;
    Image: typeof ImageFactory;
}
export declare function smugmugFactory(config: DatabaseConfig): SeqObject;
