"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditFactory = exports.Audit = exports.SessionFactory = exports.Session = exports.UserFactory = exports.User = void 0;
const sequelize_1 = require("sequelize");
const sequelize_2 = require("sequelize");
class User extends sequelize_2.Model {
    sayHello() {
        console.log('Hello, my name is ' + this.name);
        return 'hello world';
    }
    getSessions() {
        return Session.findAll({
            where: {
                userId: this.id,
            },
        });
    }
    logout(sessionId) {
        Session.destroy({
            where: {
                userId: this.id,
                sid: sessionId,
            },
        });
    }
}
exports.User = User;
function UserFactory(sequelize) {
    return User.init({
        name: sequelize_1.DataTypes.STRING,
        email: sequelize_1.DataTypes.STRING,
        password: sequelize_1.DataTypes.STRING,
        photo: sequelize_1.DataTypes.STRING,
        role: sequelize_1.DataTypes.STRING,
        locked: sequelize_1.DataTypes.BOOLEAN,
        verified: sequelize_1.DataTypes.BOOLEAN,
    }, {
        sequelize,
        tableName: 'users',
    });
}
exports.UserFactory = UserFactory;
class Session extends sequelize_2.Model {
    getUser() {
        return User.findByPk(this.userId);
    }
}
exports.Session = Session;
function SessionFactory(sequelize) {
    return Session.init({
        sid: {
            type: sequelize_1.DataTypes.STRING,
            primaryKey: true,
        },
        expires: sequelize_1.DataTypes.DATE,
        data: sequelize_1.DataTypes.JSON,
        userId: sequelize_1.DataTypes.INTEGER,
        loggedOut: sequelize_1.DataTypes.BOOLEAN,
    }, {
        sequelize,
        tableName: 'sessions',
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
