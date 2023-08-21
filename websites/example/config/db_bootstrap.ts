import { Model, Sequelize } from 'sequelize'
import {
  dbConfig,
  Log,
} from '../models'

export interface seqObject {
  [key: string]: Model | any | Sequelize
  sequelize: Sequelize
}

const seq: seqObject = {
  // @ts-ignore
  sequelize: dbConfig,
  Log,
}

seq.sequelize.sync({
  alter: true,
})

exports.seq = seq
