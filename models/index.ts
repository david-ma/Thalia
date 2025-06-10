import { Sequelize, Options } from '@sequelize/core'
import { User, UserFactory } from './security'
import { Session, SessionFactory } from './security'
import { Audit, AuditFactory } from './security'
import { SeqObject } from './types'

export function securityFactory(seqOptions: Options): SeqObject {
  if (!seqOptions.dialect) {
    seqOptions.dialect = 'mariadb'
  }
  
  seqOptions.logging = seqOptions.logging || false
  seqOptions.dialectOptions = seqOptions.dialectOptions || {
    decimalNumbers: true,
  }
  seqOptions.define = seqOptions.define || { 
    underscored: true,
    timestamps: true
  }

  const sequelize = new Sequelize(seqOptions)
  
  // Initialize models
  const User = UserFactory(sequelize)
  const Session = SessionFactory(sequelize)
  const Audit = AuditFactory(sequelize)

  // Set up associations
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

// Export all models
export * from './security'

import { AlbumFactory, ImageFactory } from './smugmug'
export function smugmugFactory(seqOptions: Options): SeqObject {
  if (!seqOptions.dialect) {
    seqOptions.dialect = 'sqlite'
    seqOptions.storage = seqOptions.storage || `${__dirname}/database.sqlite`
  }
  seqOptions.logging = seqOptions.logging || false
  seqOptions.dialectOptions = seqOptions.dialectOptions || {
    decimalNumbers: true,
  }
  seqOptions.define = seqOptions.define || { underscored: true }
  const sequelize: any = new Sequelize(seqOptions)
  const Album = AlbumFactory(sequelize)
  const Image = ImageFactory(sequelize)

  Album.hasMany(Image, { foreignKey: 'albumId', sourceKey: 'id' })
  Image.belongsTo(Album, { foreignKey: 'albumId', targetKey: 'id' })

  return {
    sequelize,
    Album,
    Image,
  }
}
