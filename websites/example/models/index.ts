import { Sequelize, Options } from 'sequelize'
import { UserFactory, SessionFactory, AuditFactory } from './security'

export function securityFactory(seqOptions: Options) {
  if (!seqOptions.dialect) {
    seqOptions.dialect = 'sqlite'
    seqOptions.storage = seqOptions.storage || `${__dirname}/database.sqlite`
  }
  seqOptions.logging = seqOptions.logging || false
  seqOptions.dialectOptions = seqOptions.dialectOptions || {
    decimalNumbers: true,
  }
  seqOptions.define = seqOptions.define || { underscored: true }
  const sequelize = new Sequelize(seqOptions)
  const User = UserFactory(sequelize)
  const Session = SessionFactory(sequelize)
  const Audit = AuditFactory(sequelize)

  Session.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' })
  User.hasMany(Session, { foreignKey: 'userId', sourceKey: 'id' })

  Audit.belongsTo(User, { foreignKey: 'userId', targetKey: 'id' })
  User.hasMany(Audit, { foreignKey: 'userId', sourceKey: 'id' })

  Audit.belongsTo(Session, { foreignKey: 'sessionId', targetKey: 'sid' })
  Session.hasMany(Audit, { foreignKey: 'sessionId', sourceKey: 'sid' })

  return {
    sequelize,
    User,
    Session,
    Audit,
  }
}
