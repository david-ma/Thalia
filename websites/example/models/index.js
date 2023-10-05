"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smugmugFactory = exports.securityFactory = void 0;
const sequelize_1 = require("sequelize");
const security_1 = require("./security");
function securityFactory(seqOptions) {
    if (!seqOptions.dialect) {
        seqOptions.dialect = 'sqlite';
        seqOptions.storage = seqOptions.storage || `${__dirname}/database.sqlite`;
    }
    seqOptions.logging = seqOptions.logging || false;
    seqOptions.dialectOptions = seqOptions.dialectOptions || {
        decimalNumbers: true,
    };
    seqOptions.define = seqOptions.define || { underscored: true };
    const sequelize = new sequelize_1.Sequelize(seqOptions);
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
        User,
        Session,
        Audit,
    };
}
exports.securityFactory = securityFactory;
const smugmug_1 = require("./smugmug");
function smugmugFactory(seqOptions) {
    if (!seqOptions.dialect) {
        seqOptions.dialect = 'sqlite';
        seqOptions.storage = seqOptions.storage || `${__dirname}/database.sqlite`;
    }
    seqOptions.logging = seqOptions.logging || false;
    seqOptions.dialectOptions = seqOptions.dialectOptions || {
        decimalNumbers: true,
    };
    seqOptions.define = seqOptions.define || { underscored: true };
    const sequelize = new sequelize_1.Sequelize(seqOptions);
    const Album = (0, smugmug_1.AlbumFactory)(sequelize);
    const Image = (0, smugmug_1.ImageFactory)(sequelize);
    Album.hasMany(Image, { foreignKey: 'albumId', sourceKey: 'id' });
    Image.belongsTo(Album, { foreignKey: 'albumId', targetKey: 'id' });
    return {
        sequelize,
        Album,
        Image,
    };
}
exports.smugmugFactory = smugmugFactory;
