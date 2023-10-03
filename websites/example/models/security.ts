import { DataTypes, Sequelize } from 'sequelize'
import {
  BuildOptions,
  Model,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize'

export interface UserAttributes {
  name: string
  email: string
  password: string
  photo: string
}

// export interface UserModel extends Model<UserAttributes>, UserAttributes {}
export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: number
  declare name: string
  declare email: string
  declare password: string
  declare photo: string
}
export type UserStatic = typeof Model & {
  new (values?: object, options?: BuildOptions): User
}
export function UserFactory(sequelize: Sequelize): UserStatic {
  return <UserStatic>sequelize.define('User', {
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    photo: DataTypes.STRING,
  })
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
export class Session extends Model<SessionModel, SessionAttributes> {
  // Worry about this later
  // public function getUser() {
  //   return User.findByPk(this.userId)
  // }
  // getUser() {
  //   console.log('running getUser')
  //   // return User.findByPk(this.userId)
  // }
}
export type SessionStatic = typeof Model & {
  new (values?: object, options?: BuildOptions): SessionModel
}
export function SessionFactory(sequelize: Sequelize): SessionStatic {
  return <SessionStatic>sequelize.define('Session', {
    sid: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    expires: DataTypes.DATE,
    data: DataTypes.JSON,
    userId: DataTypes.INTEGER,
    loggedOut: DataTypes.BOOLEAN,
  })
}

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
export type AuditStatic = typeof Model & {
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

