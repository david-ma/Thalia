import { Options } from 'sequelize'
import { securityFactory } from '../models'
import { User } from '../models/security'

let seqOptions: Options = {
  dialect: 'sqlite',
  storage: `${__dirname}/database.sqlite`,
  logging: false,
  dialectOptions: {
    decimalNumbers: true,
  },
  define: {
    underscored: true,
  },
}

if (process.env.NODE_ENV === 'docker') {
  delete seqOptions.storage

  seqOptions.database = 'postgres'
  seqOptions.username = 'postgres'
  seqOptions.password = 'postgres_password'
  seqOptions.dialect = 'postgres'
  seqOptions.host = 'db'
  seqOptions.port = 5432
}

import { seqObject } from '../../../server/helpers'

const seq: seqObject = securityFactory(seqOptions)

seq.sequelize
  .sync({
    // force: true,
    // alter: true,
  })
  .then(() => {
    User.create({
      email: 'admin@example.com',
      password: 'password',
      name: 'Admin',
      role: 'admin',
      locked: false,
      verified: false,
    })
  })

exports.seq = seq
