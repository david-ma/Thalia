"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditFactory = exports.Audit = exports.SessionFactory = exports.Session = exports.UserFactory = exports.User = void 0;
const sequelize_1 = require("sequelize");
const sequelize_2 = require("sequelize");
class User extends sequelize_2.Model {
}
exports.User = User;
function UserFactory(sequelize) {
    return sequelize.define('User', {
        name: sequelize_1.DataTypes.STRING,
        email: sequelize_1.DataTypes.STRING,
        password: sequelize_1.DataTypes.STRING,
        photo: sequelize_1.DataTypes.STRING,
    });
}
exports.UserFactory = UserFactory;
class Session extends sequelize_2.Model {
}
exports.Session = Session;
function SessionFactory(sequelize) {
    return sequelize.define('Session', {
        sid: {
            type: sequelize_1.DataTypes.STRING,
            primaryKey: true,
        },
        expires: sequelize_1.DataTypes.DATE,
        data: sequelize_1.DataTypes.JSON,
        userId: sequelize_1.DataTypes.INTEGER,
        loggedOut: sequelize_1.DataTypes.BOOLEAN,
    });
}
exports.SessionFactory = SessionFactory;
class Audit extends sequelize_2.Model {
}
exports.Audit = Audit;
function AuditFactory(sequelize) {
    return sequelize.define('Audit', {
        userId: sequelize_1.DataTypes.INTEGER,
        sessionId: sequelize_1.DataTypes.STRING,
        action: sequelize_1.DataTypes.STRING,
        blob: sequelize_1.DataTypes.JSON,
        timestamp: sequelize_1.DataTypes.DATE,
    });
}
exports.AuditFactory = AuditFactory;
