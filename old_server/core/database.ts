import { ModelStatic, Sequelize, Model } from 'sequelize'

/**
 * Database instance type for Sequelize integration
 */
export type DatabaseInstance = {
  sequelize: Sequelize
  models: {
    [key: string]: ModelStatic<any>
  }
}

/**
 * Sequelize object type for model instances
 */
export type SeqObject = {
  sequelize: Sequelize
} & Omit<
  {
    [key: string]: ModelStatic<any>
  },
  'sequelize'
>

/**
 * Checks if a Sequelize data type is valid for DataTables
 */
export function checkSequelizeDataTableTypes(type: any): boolean {
  const validTypes = [
    'STRING',
    'TEXT',
    'INTEGER',
    'BIGINT',
    'FLOAT',
    'DOUBLE',
    'DECIMAL',
    'BOOLEAN',
    'DATE',
    'DATEONLY',
    'TIME',
    'NOW',
    'UUID',
    'UUIDV1',
    'UUIDV4',
    'ENUM',
    'ARRAY',
    'JSON',
    'JSONB',
    'BLOB',
    'GEOMETRY',
    'GEOGRAPHY'
  ]
  return validTypes.includes(type)
} 