import { ModelStatic, DataTypes, Sequelize } from 'sequelize'
import { BuildOptions, Model } from 'sequelize'

export interface UserAttributes {
  name: string
  email: string
  password: string
  photo: string
}

export class User extends Model {
  public id!: number

  public name!: string
  public email!: string
  public password!: string
  public photo: string
  public role: string
  public locked: boolean
  public verified: boolean

  public isAdmin() {
    return this.role.indexOf('admin') > -1
  }

  public getSessions() {
    return Session.findAll({
      where: {
        userId: this.id,
      },
    })
  }

  public logout(sessionId: string) {
    Session.destroy({
      where: {
        userId: this.id,
        sid: sessionId,
      },
    })
  }
}

export interface UserModel extends Model<UserAttributes>, UserAttributes {}

// export type UserStatic = typeof Model & {
export type UserStatic = ModelStatic<User> & {
  new (values?: object, options?: BuildOptions): UserModel
}

export function UserFactory(sequelize: Sequelize): UserStatic {
  return User.init(
    {
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      photo: DataTypes.STRING,
      role: DataTypes.STRING,
      locked: DataTypes.BOOLEAN,
      verified: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      tableName: 'users',
    }
  )
}

export interface SessionAttributes {
  sid: string
  expires: Date
  data: Object
  userId: number
  loggedOut: boolean
}

export interface SessionModel extends Model<SessionAttributes>, SessionAttributes {}
export class Session extends Model implements SessionAttributes {
  public sid!: string
  public expires!: Date
  public data!: Object
  public userId!: number
  public loggedOut!: boolean

  // Worry about this later
  public getUser() {
    return User.findByPk(this.userId)
  }
  // getUser() {
  //   console.log('running getUser')
  //   // return User.findByPk(this.userId)
  // }
}
// export type SessionStatic = typeof Model & {
export type SessionStatic = ModelStatic<Session> & {
  new (values?: object, options?: BuildOptions): SessionModel
}
export function SessionFactory(sequelize: Sequelize): SessionStatic {
  return Session.init(
    {
      sid: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      expires: DataTypes.DATE,
      data: DataTypes.JSON,
      userId: DataTypes.INTEGER,
      loggedOut: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      tableName: 'sessions',
    }
  )
}

// export function SessionFactory(sequelize: Sequelize): SessionStatic {
//   return <SessionStatic>sequelize.define('Session', {
//     sid: {
//       type: DataTypes.STRING,
//       primaryKey: true,
//     },
//     expires: DataTypes.DATE,
//     data: DataTypes.JSON,
//     userId: DataTypes.INTEGER,
//     loggedOut: DataTypes.BOOLEAN,
//   })
// }

export interface AuditAttributes {
  id: number
  ip: string
  userId: number
  sessionId: string
  action: string
  blob: object
  timestamp: Date
}

export interface AuditModel extends Model<AuditAttributes>, AuditAttributes {}
export class Audit extends Model implements AuditAttributes {
  public id!: number
  public ip!: string
  public userId!: number
  public sessionId!: string
  public action!: string
  public blob!: object
  public timestamp!: Date
}

// export type AuditStatic = typeof Model & {
export type AuditStatic = ModelStatic<Audit> & {
  new (values?: object, options?: BuildOptions): AuditModel
}
export function AuditFactory(sequelize: Sequelize): AuditStatic {
  return <AuditStatic>sequelize.define('Audit', {
    userId: DataTypes.INTEGER,
    ip: DataTypes.STRING,
    sessionId: DataTypes.STRING,
    action: DataTypes.STRING,
    blob: DataTypes.JSON,
    timestamp: DataTypes.DATE,
  })
}
