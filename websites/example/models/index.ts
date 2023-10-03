import * as sequelize from 'sequelize'

// Default options
let seqOptions: sequelize.Options = {
  "dialect": "sqlite",
  "storage": `${__dirname}/database.sqlite`,
  // "storage": "websites/dataviz/models/dataviz_production.sqlite",
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

console.log('seqOptions', seqOptions)

// Initialise Sequelize
export const dbConfig: sequelize.Sequelize = new sequelize.Sequelize(seqOptions)

// Initialise models
