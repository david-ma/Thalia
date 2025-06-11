import { Sequelize, Model, ModelStatic } from '@sequelize/core';
import { SeqObject } from '../models/types';
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
export declare class Database implements SeqObject {
    private static instance;
    sequelize: Sequelize;
    models: {
        [key: string]: ModelStatic<Model>;
    };
    private constructor();
    static getInstance(config?: DatabaseConfig): Database;
    connect(): Promise<void>;
    sync(options?: {
        force?: boolean;
        alter?: boolean;
    }): Promise<void>;
    getModels(): SeqObject;
    getSequelize(): Sequelize;
    close(): Promise<void>;
}
