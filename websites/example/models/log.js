"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogFactory = void 0;
const sequelize_1 = require("sequelize");
function LogFactory(sequelize) {
    return sequelize.define('Log', {
        url: sequelize_1.DataTypes.STRING,
        ipAddress: sequelize_1.DataTypes.STRING,
        message: sequelize_1.DataTypes.STRING,
        data: sequelize_1.DataTypes.JSON,
    });
}
exports.LogFactory = LogFactory;
