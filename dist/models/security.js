import { Model, DataTypes } from '@sequelize/core';
// User Model
export class User extends Model {
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
export function UserFactory(sequelize) {
    return User.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        photo: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        role: {
            type: DataTypes.STRING,
            defaultValue: 'user',
            validate: {
                isIn: [['admin', 'user', 'guest']],
            },
        },
        locked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
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
// Session Model
export class Session extends Model {
    async getUser() {
        return User.findByPk(this.userId);
    }
}
export function SessionFactory(sequelize) {
    return Session.init({
        sid: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        expires: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        data: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        loggedOut: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        tableName: 'sessions',
    });
}
// Audit Model
export class Audit extends Model {
}
export function AuditFactory(sequelize) {
    return Audit.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        ip: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        sessionId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        blob: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        tableName: 'audits',
    });
}
//# sourceMappingURL=security.js.map