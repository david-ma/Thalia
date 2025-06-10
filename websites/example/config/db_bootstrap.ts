import { Options } from 'sequelize'
import { securityFactory } from '../models'
import { User } from '../models/security'
const cred = require('./cred.js').cred

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

import { SeqObject } from '../../../server/core/database'

const seq: SeqObject = securityFactory(seqOptions)

seq.sequelize
  .sync({
    // force: true,
    // alter: true,
  })
  .then(() => {
    cred.users.forEach((user: any) => {
      User.findOrCreate({
        where: {
          email: user.email,
        },
        defaults: user,
      })
    })
  })

exports.seq = seq
