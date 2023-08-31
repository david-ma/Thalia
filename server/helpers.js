"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPackage = exports.hello = void 0;
const sequelize_1 = require("sequelize");
const sequelize_2 = require("sequelize");
const fs = require('fs');
function hello() {
    console.log('hello world');
}
exports.hello = hello;
function checkPackage() {
    fs.readFile('package.json', 'utf8', function (err, data) {
        console.log(data);
    });
}
exports.checkPackage = checkPackage;
const SequelizeDataTableTypes = {
    STRING: 'string',
    TEXT: 'string',
    INTEGER: 'num',
    BIGINT: 'num',
    FLOAT: 'num',
    REAL: 'num',
    DOUBLE: 'num',
    DECIMAL: 'num',
    DATE: 'date',
    DATEONLY: 'date',
    BOOLEAN: 'bool',
    ENUM: 'string',
    ARRAY: 'string',
    JSON: 'string',
    JSONB: 'string',
    BLOB: 'string',
};
const checkSequelizeDataTableTypes = function (type) {
    switch (type) {
        case sequelize_2.DataTypes.STRING:
            return 'string';
        case sequelize_2.DataTypes.TEXT:
            return 'string';
        case sequelize_2.DataTypes.INTEGER:
            return 'num';
        case sequelize_2.DataTypes.BIGINT:
            return 'num';
        default:
            return 'string';
    }
};
function crud(options) {
    return function (controller) {
        const table = controller.db[options.tableName];
        const path = controller.path;
        switch (path[0]) {
            case 'columns':
                columnDefinitions(controller, table);
                break;
            case 'json':
                dataTableJson(controller, table);
            default:
        }
    };
}
function columnDefinitions(controller, table) {
    console.log('Getting column definitions');
    const data = Object.entries(table.getAttributes())
        .filter(([key, value]) => !value.references)
        .map(([key, value]) => {
        return {
            name: key,
            title: key,
            data: key,
            type: SequelizeDataTableTypes[value.type.key],
        };
    });
    controller.res.end(JSON.stringify(data));
}
function dataTableJson(controller, table) {
    const [order, search] = parseDTquery(controller.query);
    const columns = Object.entries(table.getAttributes())
        .filter(([key, value]) => !value.references)
        .map(([key, value]) => {
        return {
            name: key,
            title: key,
            data: key,
            type: SequelizeDataTableTypes[value.type.key],
        };
    });
    const findOptions = {
        offset: controller.query.start || 0,
        limit: controller.query.length || 10,
        order: order.map((item) => {
            return [columns[item.column].data, item.dir.toUpperCase()];
        }),
    };
    if (search.value) {
        findOptions['where'] = {
            [sequelize_1.Op.or]: columns
                .filter((column) => column.type === 'string')
                .map((column) => {
                return {
                    [column.data]: {
                        [sequelize_1.Op.iLike]: `%${search.value}%`,
                    },
                };
            }),
        };
    }
    Promise.all([
        table.findAll(findOptions),
        table.count(),
        table.count(findOptions),
    ]).then(([items, recordsTotal, recordsFiltered]) => {
        const blob = {
            draw: controller.query.draw || 1,
            recordsTotal,
            recordsFiltered,
            data: items.map((item) => item.dataValues),
        };
        controller.res.end(JSON.stringify(blob));
    });
}
function parseDTquery(queryStrings) {
    const columns = [];
    const order = [];
    const search = {
        value: '',
        regex: false,
    };
    Object.entries(queryStrings).forEach(([key, value]) => {
        if (key.slice(0, 7) === 'columns') {
            const [_, index, column] = key.split(/[\[\]]+/);
            columns[index] = columns[index] || {};
            columns[index][column] = value;
        }
        if (key.slice(0, 5) === 'order') {
            const [_, index, column] = key.split(/[\[\]]+/);
            order[index] = order[index] || {};
            order[index][column] = value;
        }
        if (key.slice(0, 6) === 'search') {
            const [_, column] = key.split(/[\[\]]+/);
            search[column] = value;
        }
    });
    columns.forEach((column) => {
        column.searchable = parseBoolean(column.searchable);
        column.orderable = parseBoolean(column.orderable);
    });
    order.forEach((item) => {
        item.column = parseInt(item.column);
    });
    search.regex = parseBoolean(search.regex);
    return [order, search];
}
function parseBoolean(string) {
    return string === 'true' || string === '1' || string === true;
}
exports.default = { crud, hello, checkPackage };
