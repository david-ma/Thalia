"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const core_1 = require("@sequelize/core");
class Database {
    constructor(config) {
        this.models = {};
        const options = {
            dialect: 'mariadb',
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            logging: config.logging ?? false,
            pool: config.pool || {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            },
            define: {
                underscored: true,
                timestamps: true
            }
        };
        this.sequelize = new core_1.Sequelize(options);
    }
    static getInstance(config) {
        if (!Database.instance) {
            if (!config) {
                throw new Error('Database configuration is required for initialization');
            }
            Database.instance = new Database(config);
        }
        return Database.instance;
    }
    async connect() {
        try {
            await this.sequelize.authenticate();
            console.log('Database connection established successfully');
        }
        catch (error) {
            console.error('Unable to connect to the database:', error);
            throw error;
        }
    }
    async sync(options) {
        try {
            await this.sequelize.sync(options);
            console.log('Database synchronized successfully');
        }
        catch (error) {
            console.error('Error synchronizing database:', error);
            throw error;
        }
    }
    getModels() {
        return {
            sequelize: this.sequelize,
            models: this.models
        };
    }
    getSequelize() {
        return this.sequelize;
    }
    async close() {
        await this.sequelize.close();
    }
}
exports.Database = Database;
//# sourceMappingURL=database.js.map