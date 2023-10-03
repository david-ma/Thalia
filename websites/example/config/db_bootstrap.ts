import { Model, Sequelize } from 'sequelize'
import {
  dbConfig,
} from '../models'

export interface seqObject {
  [key: string]: Model | any | Sequelize
  sequelize: Sequelize
}

const seq: seqObject = {
  // @ts-ignore
  sequelize: dbConfig,
}

seq.sequelize.sync({
  alter: true,
})

exports.seq = seq
