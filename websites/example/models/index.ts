import * as sequelize from 'sequelize'
import { LogFactory } from './log'

// Default options
let seqOptions: sequelize.Options = {
  database: 'postgres',
  username: 'postgres',
  password: 'postgres_password',
  dialect: 'postgres',
  host: 'localhost',
  port: 5555,
  logging: false,
  dialectOptions: {
    decimalNumbers: true,
  },
  define: {
    underscored: true,
  },
}

if (process.env.NODE_ENV === 'docker') {
  seqOptions.host = 'db'
  seqOptions.port = 5432
}

console.log('seqOptions', seqOptions)

// Initialise Sequelize
export const dbConfig: sequelize.Sequelize = new sequelize.Sequelize(seqOptions)

// Initialise models
export const Log = LogFactory(dbConfig)
