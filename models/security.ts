import { Model, InferAttributes, InferCreationAttributes, CreationOptional, DataTypes, Sequelize } from '@sequelize/core'

// User Model
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>
  declare name: string
  declare email: string
  declare password: string
  declare photo: CreationOptional<string>
  declare role: CreationOptional<string>
  declare locked: CreationOptional<boolean>
  declare verified: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  isAdmin(): boolean {
    return this.role?.indexOf('admin') > -1
  }

  async getSessions() {
    return Session.findAll({
      where: {
        userId: this.id,
      },
    })
  }

  async logout(sessionId: string) {
    return Session.destroy({
      where: {
        userId: this.id,
        sid: sessionId,
      },
    })
  }
}

export function UserFactory(sequelize: Sequelize) {
  return User.init(
    {
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
    },
    {
      sequelize,
      tableName: 'users',
      hooks: {
        beforeCreate: async (user: User) => {
          if (user.password) {
            // TODO: Add password hashing
            // user.password = await hashPassword(user.password)
          }
        },
      },
    }
  )
}

// Session Model
export class Session extends Model<InferAttributes<Session>, InferCreationAttributes<Session>> {
  declare sid: string
  declare expires: Date
  declare data: CreationOptional<Record<string, any>>
  declare userId: CreationOptional<number>
  declare loggedOut: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  async getUser() {
    return User.findByPk(this.userId)
  }
}

export function SessionFactory(sequelize: Sequelize) {
  return Session.init(
    {
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
    },
    {
      sequelize,
      tableName: 'sessions',
    }
  )
}

// Audit Model
export class Audit extends Model<InferAttributes<Audit>, InferCreationAttributes<Audit>> {
  declare id: CreationOptional<number>
  declare userId: CreationOptional<number>
  declare ip: string
  declare sessionId: CreationOptional<string>
  declare action: string
  declare blob: CreationOptional<Record<string, any>>
  declare timestamp: CreationOptional<Date>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

export function AuditFactory(sequelize: Sequelize) {
  return Audit.init(
    {
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
    },
    {
      sequelize,
      tableName: 'audits',
    }
  )
}
