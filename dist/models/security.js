"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditFactory = exports.Audit = exports.SessionFactory = exports.Session = exports.UserFactory = exports.User = void 0;
const core_1 = require("@sequelize/core");
// User Model
class User extends core_1.Model {
    isAdmin() {
        return this.role?.indexOf('admin') > -1;
    }
    async getSessions() {
        return Session.findAll({
            where: {
                userId: this.id,
            },
        });
    }
    async logout(sessionId) {
        return Session.destroy({
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
        id: {
            type: core_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: core_1.DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: core_1.DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: core_1.DataTypes.STRING,
            allowNull: false,
        },
        photo: {
            type: core_1.DataTypes.STRING,
            allowNull: true,
        },
        role: {
            type: core_1.DataTypes.STRING,
            defaultValue: 'user',
            validate: {
                isIn: [['admin', 'user', 'guest']],
            },
        },
        locked: {
            type: core_1.DataTypes.BOOLEAN,
            defaultValue: false,
        },
        verified: {
            type: core_1.DataTypes.BOOLEAN,
            defaultValue: false,
        },
        createdAt: core_1.DataTypes.DATE,
        updatedAt: core_1.DataTypes.DATE,
    }, {
        sequelize,
        tableName: 'users',
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    // TODO: Add password hashing
                    // user.password = await hashPassword(user.password)
                }
            },
        },
    });
}
exports.UserFactory = UserFactory;
// Session Model
class Session extends core_1.Model {
    async getUser() {
        return User.findByPk(this.userId);
    }
}
exports.Session = Session;
function SessionFactory(sequelize) {
    return Session.init({
        sid: {
            type: core_1.DataTypes.STRING,
            primaryKey: true,
        },
        expires: {
            type: core_1.DataTypes.DATE,
            allowNull: false,
        },
        data: {
            type: core_1.DataTypes.JSON,
            allowNull: true,
        },
        userId: {
            type: core_1.DataTypes.INTEGER,
            allowNull: true,
        },
        loggedOut: {
            type: core_1.DataTypes.BOOLEAN,
            defaultValue: false,
        },
        createdAt: core_1.DataTypes.DATE,
        updatedAt: core_1.DataTypes.DATE,
    }, {
        sequelize,
        tableName: 'sessions',
    });
}
exports.SessionFactory = SessionFactory;
// Audit Model
class Audit extends core_1.Model {
}
exports.Audit = Audit;
function AuditFactory(sequelize) {
    return Audit.init({
        id: {
            type: core_1.DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: core_1.DataTypes.INTEGER,
            allowNull: true,
        },
        ip: {
            type: core_1.DataTypes.STRING,
            allowNull: false,
        },
        sessionId: {
            type: core_1.DataTypes.STRING,
            allowNull: true,
        },
        action: {
            type: core_1.DataTypes.STRING,
            allowNull: false,
        },
        blob: {
            type: core_1.DataTypes.JSON,
            allowNull: true,
        },
        timestamp: {
            type: core_1.DataTypes.DATE,
            defaultValue: core_1.DataTypes.NOW,
        },
        createdAt: core_1.DataTypes.DATE,
        updatedAt: core_1.DataTypes.DATE,
    }, {
        sequelize,
        tableName: 'audits',
    });
}
exports.AuditFactory = AuditFactory;
//# sourceMappingURL=security.js.map