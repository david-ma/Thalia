"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smugmugFactory = exports.securityFactory = void 0;
const core_1 = require("@sequelize/core");
const security_1 = require("./security");
const smugmug_1 = require("./smugmug");
function securityFactory(config) {
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
    const sequelize = new core_1.Sequelize(options);
    const User = (0, security_1.UserFactory)(sequelize);
    const Session = (0, security_1.SessionFactory)(sequelize);
    const Audit = (0, security_1.AuditFactory)(sequelize);
    Session.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });
    User.hasMany(Session, { foreignKey: 'userId', sourceKey: 'id' });
    Audit.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' });
    User.hasMany(Audit, { foreignKey: 'userId', sourceKey: 'id' });
    Audit.belongsTo(Session, { foreignKey: 'sessionId', targetKey: 'sid' });
    Session.hasMany(Audit, { foreignKey: 'sessionId', sourceKey: 'sid' });
    return {
        sequelize,
        models: {
            User,
            Session,
            Audit,
        }
    };
}
exports.securityFactory = securityFactory;
// Export all models
__exportStar(require("./security"), exports);
function smugmugFactory(config) {
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
    const sequelize = new core_1.Sequelize(options);
    const Album = (0, smugmug_1.AlbumFactory)(sequelize);
    const Image = (0, smugmug_1.ImageFactory)(sequelize);
    Album.hasMany(Image, { foreignKey: 'albumId', sourceKey: 'id' });
    Image.belongsTo(Album, { foreignKey: 'albumId', targetKey: 'id' });
    return {
        sequelize,
        models: {
            Album,
            Image,
        }
    };
}
exports.smugmugFactory = smugmugFactory;
//# sourceMappingURL=index.js.map