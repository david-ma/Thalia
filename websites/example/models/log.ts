import { DataTypes, Sequelize } from 'sequelize'

import { LogStatic } from './models'
export function LogFactory(sequelize: Sequelize): LogStatic {
  return <LogStatic>sequelize.define('Log', {
    url: DataTypes.STRING,
    ipAddress: DataTypes.STRING,
    message: DataTypes.STRING,
    data: DataTypes.JSON,
  })
}
