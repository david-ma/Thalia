import { ModelStatic, Sequelize } from 'sequelize';
/**
 * Database instance type for Sequelize integration
 */
export type DatabaseInstance = {
    sequelize: Sequelize;
    models: {
        [key: string]: ModelStatic<any>;
    };
};
/**
 * Sequelize object type for model instances
 */
export type SeqObject = {
    sequelize: Sequelize;
} & Omit<{
    [key: string]: ModelStatic<any>;
}, 'sequelize'>;
/**
 * Checks if a Sequelize data type is valid for DataTables
 */
export declare function checkSequelizeDataTableTypes(type: any): boolean;
