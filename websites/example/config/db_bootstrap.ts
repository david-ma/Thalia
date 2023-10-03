import { Model, Sequelize, Options } from 'sequelize'
import { securityFactory } from '../models'

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

export interface seqObject {
  [key: string]: Model | any | Sequelize
  sequelize: Sequelize
}

const seq: seqObject = securityFactory(seqOptions)

seq.sequelize.sync({
  alter: true,
})

exports.seq = seq
