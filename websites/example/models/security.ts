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
  public photo!: string

  public sayHello() {
    console.log('Hello, my name is ' + this.name)
    return 'hello world'
  }

  public getSessions() {
    return Session.findAll({
      where: {
        userId: this.id,
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

export interface SessionModel
  extends Model<SessionAttributes>,
    SessionAttributes {}
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
  userId: number
  sessionId: string
  action: string
  blob: object
  timestamp: Date
}

export interface AuditModel extends Model<AuditAttributes>, AuditAttributes {}
export class Audit extends Model<AuditModel, AuditAttributes> {}

// export type AuditStatic = typeof Model & {
export type AuditStatic = ModelStatic<Audit> & {
  new (values?: object, options?: BuildOptions): AuditModel
}
export function AuditFactory(sequelize: Sequelize): AuditStatic {
  return <AuditStatic>sequelize.define('Audit', {
    userId: DataTypes.INTEGER,
    sessionId: DataTypes.STRING,
    action: DataTypes.STRING,
    blob: DataTypes.JSON,
    timestamp: DataTypes.DATE,
  })
}