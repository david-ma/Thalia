import { SeqObject } from 'thalia'
import { securityFactory } from 'thalia'
import { DatabaseConfig } from 'thalia'
import { UserFactory } from 'thalia'
const cred = require('./cred.js').cred

let seqOptions: DatabaseConfig = {
  dialect: 'mariadb',
  host: 'localhost',
  port: 3306,
  database: 'thalia',
  user: 'thalia',
  password: 'thalia',
  logging: false,
}

const seq: SeqObject = securityFactory(seqOptions)
const User = UserFactory(seq.sequelize)

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
