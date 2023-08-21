import { BuildOptions, Model } from 'sequelize'

export interface LogAttributes {
  url: string
  ipAddress: string
  message: string
  data: object
}
export interface LogModel extends Model<LogAttributes>, LogAttributes {}
export class Log extends Model<LogModel, LogAttributes> {}
export type LogStatic = typeof Model & {
  new (values?: object, options?: BuildOptions): LogModel
}
