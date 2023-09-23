"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const sequelize_2 = require("sequelize");
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const requestHandlers_1 = require("./requestHandlers");
function crud(options) {
    const references = options.references || [];
    return {
        [options.tableName.toLowerCase()]: function (controller) {
            const hideColumns = options.hideColumns || [];
            const security = options.security || noSecurity;
            security(controller, function ([views, usermodel]) {
                const table = controller.db[options.tableName];
                const primaryKey = table.primaryKeyAttribute;
                const uriPath = controller.path;
                switch (uriPath[0] || '') {
                    case 'columns':
                        columnDefinitions(controller, table, hideColumns);
                        break;
                    case 'json':
                        dataTableJson(controller, table, hideColumns, references);
                        break;
                    case '':
                        Promise.all([
                            new Promise(controller.readAllViews),
                            (0, requestHandlers_1.loadMustacheTemplate)(path.join(__dirname, '..', 'src', 'views', 'partials', 'wrapper.hbs')),
                        ])
                            .catch((e) => {
                            console.log('Error loading views');
                            return Promise.reject(e);
                        })
                            .then(([views, loadedTemplate]) => {
                            const template = Handlebars.compile(loadedTemplate.content);
                            Handlebars.registerPartial('scripts', loadedTemplate.scripts);
                            Handlebars.registerPartial('styles', loadedTemplate.styles);
                            Handlebars.registerPartial('content', views.list);
                            loadViewsAsPartials(views);
                            const attributes = table.getAttributes();
                            const primaryKey = Object.keys(attributes).filter((key) => {
                                return attributes[key].primaryKey;
                            });
                            const links = references
                                .map((reference) => {
                                const table = controller.db[reference];
                                const name = reference;
                                const tableName = table.tableName;
                                const attribute = Object.values(attributes).filter((attribute) => {
                                    return (attribute.references &&
                                        typeof attribute.references === 'object' &&
                                        attribute.references.model === tableName);
                                })[0];
                                if (attribute) {
                                    return JSON.stringify({
                                        name,
                                        tableName,
                                        attribute,
                                    });
                                }
                                else {
                                    return null;
                                }
                            })
                                .filter((link) => link !== null);
                            const data = {
                                title: options.tableName,
                                controllerName: options.tableName.toLowerCase(),
                                links,
                                primaryKey,
                            };
                            const html = template(data);
                            controller.res.end(html);
                        })
                            .catch((e) => {
                            console.log('Error rendering template', e);
                            controller.res.end('Error rendering template');
                        });
                        break;
                    default:
                        Promise.all([
                            new Promise(controller.readAllViews),
                            (0, requestHandlers_1.loadMustacheTemplate)(path.join(__dirname, '..', 'src', 'views', 'partials', 'wrapper.hbs')),
                        ]).then(([views, loadedTemplate]) => {
                            const template = Handlebars.compile(loadedTemplate.content);
                            Handlebars.registerPartial('scripts', loadedTemplate.scripts);
                            Handlebars.registerPartial('styles', loadedTemplate.styles);
                            Handlebars.registerPartial('content', views.read);
                            loadViewsAsPartials(views);
                            table
                                .findOne({
                                where: {
                                    [primaryKey]: controller.path[0],
                                },
                            })
                                .then((item) => {
                                const data = {
                                    title: options.tableName,
                                    controller: options.tableName.toLowerCase(),
                                    item: item.dataValues,
                                    json: JSON.stringify(item.dataValues),
                                    attributes: Object.keys(item.dataValues),
                                };
                                const html = template(data);
                                controller.res.end(html);
                            }, (e) => {
                                console.log('Error finding item', e);
                                controller.res.end(`Error finding item: ${uriPath[0]}`);
                            });
                        });
                }
            });
        },
    };
}
const noSecurity = async function (controller, success, failure) {
    success([{}, {}]);
};
function loadViewsAsPartials(views) {
    Object.entries(views).forEach(([key, value]) => {
        Handlebars.registerPartial(key, value);
    });
}
function columnDefinitions(controller, table, hideColumns = []) {
    const data = Object.entries(table.getAttributes())
        .filter(([key, value]) => !hideColumns.includes(key))
        .map(mapColumns);
    controller.res.end(JSON.stringify(data));
}
function mapColumns([key, value]) {
    const type = SequelizeDataTableTypes[value.type.key];
    const orderable = type === 'string' || type === 'num' || type === 'date';
    const searchable = type === 'string' || type === 'num' || type === 'date';
    var blob = {
        name: key,
        title: key,
        data: key,
        orderable,
        searchable,
        type,
    };
    return blob;
}
function dataTableJson(controller, table, hideColumns = [], references = []) {
    const [order, search] = parseDTquery(controller.query);
    const columns = Object.entries(table.getAttributes())
        .filter(([key, value]) => !value.references)
        .filter(([key, value]) => !hideColumns.includes(key))
        .map(mapColumns);
    const findOptions = {
        include: references.map((table) => {
            return controller.db[table];
        }),
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
    JSON: 'object',
    JSONB: 'object',
    BLOB: 'object',
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
exports.default = { crud };
