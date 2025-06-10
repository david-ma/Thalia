"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSequelizeDataTableTypes = void 0;
/**
 * Checks if a Sequelize data type is valid for DataTables
 */
function checkSequelizeDataTableTypes(type) {
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
    ];
    return validTypes.includes(type);
}
exports.checkSequelizeDataTableTypes = checkSequelizeDataTableTypes;
//# sourceMappingURL=database.js.map