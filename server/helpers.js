"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortParams = exports.htmlEscape = exports.oauthEscape = exports.Audit = exports.User = exports.Session = exports.crud = exports.users = exports.checkSession = exports.emailNewAccount = exports.checkEmail = exports.createSession = exports.smugmugFactory = exports.securityFactory = exports.Image = exports.Album = exports.loadViewsAsPartials = exports.setHandlebarsContent = exports.Thalia = void 0;
const sequelize_1 = require("sequelize");
const thalia_1 = require("./thalia");
Object.defineProperty(exports, "Thalia", { enumerable: true, get: function () { return thalia_1.Thalia; } });
const sequelize_2 = require("sequelize");
const path = require('path');
const requestHandlers_1 = require("./requestHandlers");
const formidable = require("formidable");
function crud(options) {
    const references = options.references || [];
    return {
        [options.tableName.toLowerCase()]: function (controller) {
            const Handlebars = controller.handlebars;
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
                            loadViewsAsPartials(views, Handlebars);
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
                            loadViewsAsPartials(views, Handlebars);
                            table
                                .findOne({
                                where: {
                                    [primaryKey]: controller.path[0],
                                },
                            })
                                .then((item) => {
                                const values = Object.entries(item.dataValues).reduce((obj, [key, value]) => {
                                    if (!hideColumns.includes(key)) {
                                        obj[key] = value;
                                    }
                                    return obj;
                                }, {});
                                const data = {
                                    title: options.tableName,
                                    controller: options.tableName.toLowerCase(),
                                    values,
                                    json: JSON.stringify(values),
                                    attributes: Object.keys(values),
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
exports.crud = crud;
const noSecurity = async function (controller, success, failure) {
    success([{}, null]);
};
const sass = require('sass');
async function setHandlebarsContent(content, Handlebars) {
    const scriptEx = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/g;
    const styleEx = /<style\b.*>([^<]*(?:(?!<\/style>)<[^<]*)*)<\/style>/g;
    const scripts = [...content.matchAll(scriptEx)].map((d) => d[0]);
    const styles = [...content.matchAll(styleEx)].map((d) => d[0]);
    let styleData = styles.join('\n').replace(/<\/?style>/g, '');
    return sass.compileStringAsync(styleData).then((result) => {
        styleData = result.css;
        Handlebars.registerPartial('styles', `<style>${styleData}</style>`);
        Handlebars.registerPartial('scripts', scripts.join('\n'));
        Handlebars.registerPartial('content', content.replace(scriptEx, '').replace(styleEx, ''));
    }, () => {
        console.log('Error processing SASS!');
        Handlebars.registerPartial('styles', '');
        Handlebars.registerPartial('scripts', '');
        Handlebars.registerPartial('content', content);
    });
}
exports.setHandlebarsContent = setHandlebarsContent;
function loadViewsAsPartials(views, Handlebars) {
    Object.entries(views).forEach(([key, value]) => {
        Handlebars.registerPartial(key, value);
    });
    Handlebars.registerHelper('getValue', function (field, options) {
        if (!options || !options.data || !options.data.root) {
            return '';
        }
        if (options.data.root[field]) {
            return options.data.root[field];
        }
        if (!options.data.root.blob) {
            return '';
        }
        return options.data.root.blob[field] || '';
    });
    Handlebars.registerHelper('isSelected', function (field, value, options) {
        if (!options || !options.data || !options.data.root) {
            return '';
        }
        if (options.data.root[field] === value) {
            return 'selected';
        }
        if (options.data.root.blob && options.data.root.blob[field] === value) {
            return 'selected';
        }
        return '';
    });
}
exports.loadViewsAsPartials = loadViewsAsPartials;
function columnDefinitions(controller, table, hideColumns = []) {
    const data = Object.entries(table.getAttributes())
        .filter(([key, value]) => !hideColumns.includes(key))
        .map(mapColumns);
    controller.res.end(JSON.stringify(data));
}
function mapColumns([key, value]) {
    const type = SequelizeDataTableTypes[value.type.key];
    const allowedTypes = ['string', 'num', 'date', 'bool'];
    const orderable = allowedTypes.includes(type);
    const searchable = allowedTypes.includes(type);
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
const security_1 = require("../websites/example/models/security");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return security_1.User; } });
Object.defineProperty(exports, "Session", { enumerable: true, get: function () { return security_1.Session; } });
Object.defineProperty(exports, "Audit", { enumerable: true, get: function () { return security_1.Audit; } });
var smugmug_1 = require("../websites/example/models/smugmug");
Object.defineProperty(exports, "Album", { enumerable: true, get: function () { return smugmug_1.Album; } });
Object.defineProperty(exports, "Image", { enumerable: true, get: function () { return smugmug_1.Image; } });
const models_1 = require("../websites/example/models");
Object.defineProperty(exports, "securityFactory", { enumerable: true, get: function () { return models_1.securityFactory; } });
Object.defineProperty(exports, "smugmugFactory", { enumerable: true, get: function () { return models_1.smugmugFactory; } });
async function createSession(userId, controller, noCookie) {
    const token = Math.random().toString(36).substring(2, 15);
    const data = controller.req
        ? {
            'x-forwarded-for': controller.req.headers['x-forwarded-for'],
            'x-real-ip': controller.req.headers['x-real-ip'],
            remoteAddress: controller.req.connection.remoteAddress,
            ip: controller.ip,
            userAgent: controller.req.headers['user-agent'],
        }
        : {};
    return controller.db.Session.create({
        sid: token,
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        data: data,
        loggedOut: false,
        userId,
    }).then((session) => {
        if (!noCookie) {
            const name = controller.name || 'thalia';
            controller.res.setCookie({ [`_${name}_login`]: token }, session.expires);
        }
        return session;
    });
}
exports.createSession = createSession;
const nodemailer = require('nodemailer');
function sendEmail(emailOptions, mailAuth) {
    console.log(`Sending email to ${emailOptions.to}`);
    const transporter = nodemailer.createTransport({
        pool: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: mailAuth,
        tls: { rejectUnauthorized: false },
    });
    transporter.verify(function (error) {
        if (error) {
            console.log('Nodemailer error');
            console.log(error);
        }
        else {
            console.log('Nodemailer: Server is ready to take our messages');
        }
    });
    transporter.sendMail(emailOptions, function (error, info) {
        if (error) {
            console.log(error);
        }
        else {
            console.log('Email sent: ' + info.response);
        }
    });
}
function checkEmail(controller) {
    controller.readAllViews(function (views) {
        const template = controller.handlebars.compile(views.invite);
        const html = template({});
        controller.res.end(html);
    });
}
exports.checkEmail = checkEmail;
async function emailNewAccount(config) {
    const password = Math.random().toString(36).substring(2, 15);
    const User = config.controller.db.User;
    return User.findOrCreate({
        where: {
            email: config.email,
        },
        defaults: {
            email: config.email,
            password,
        },
    }).then(([user, created]) => {
        return createSession(user.id, config.controller, true).then((session) => {
            let message = `You're invited to be an admin of Sabbatical Gallery.<br><a href="https://sabbatical.gallery/profile?session=${session.sid}">Click here set up your account</a>.<br>Then visit <a href="https://sabbatical.gallery/m">https://sabbatical.gallery/m</a> to manage the gallery.`;
            if (!created) {
                message = `Here is a new login link for Sabbatical Gallery.<br><a href="https://sabbatical.gallery/profile?session=${session.sid}">Click here to log in</a>.`;
            }
            const emailOptions = {
                from: '"Sabbatical Gallery" <7oclockco@gmail.com>',
                to: config.email,
                subject: 'Your Sabbatical Gallery admin invite',
                html: message,
            };
            sendEmail(emailOptions, config.mailAuth);
        });
    });
}
exports.emailNewAccount = emailNewAccount;
const checkSession = async function (controller, success, naive) {
    const name = controller.name || 'thalia';
    const cookies = controller.cookies || {};
    let login_token = cookies[`_${name}_login`] || null;
    const query = controller.query;
    if (query && query.session) {
        controller.res.setCookie({ [`_${name}_login`]: query.session }, new Date(Date.now() + 1000 * 60 * 60 * 24 * 7));
        login_token = query.session;
    }
    else if (!login_token) {
        if (naive) {
            return naive();
        }
        else {
            controller.res.end(`<script>window.location = '/login?redirect=${controller.req.url}'</script>`);
            return;
        }
    }
    return Promise.all([
        new Promise(controller.readAllViews).then((views) => {
            loadViewsAsPartials(views, controller.handlebars);
            return views;
        }),
        controller.db.Session.findOne({
            where: {
                sid: login_token,
            },
        }).then((session) => session
            ? controller.db.User.findOne({
                where: {
                    id: session.userId,
                },
            })
            : Promise.reject('No session found. Please log in.')),
    ]).then(function ([views, user]) {
        if (user.locked) {
            controller.res.end('Your account is locked. Please contact an admin.');
            return;
        }
        success([views, user]);
    }, function (err) {
        console.log('ERROR!', err);
        controller.res.end('<meta http-equiv="refresh" content="0; url=/logout">');
    });
};
exports.checkSession = checkSession;
function users(options) {
    return {
        profile: function (controller) {
            (0, exports.checkSession)(controller, function ([views, user]) {
                const filter = ['id', 'role', 'createdAt', 'updatedAt'];
                const data = {
                    user: Object.entries(user.dataValues).reduce((obj, [key, value]) => {
                        if (!filter.includes(key)) {
                            obj[key] = value;
                        }
                        return obj;
                    }, {}),
                    unverified: !user.verified,
                    admin: user.role === 'admin',
                };
                user.getSessions().then((sessions) => {
                    data.sessions = sessions.map((session) => {
                        return {
                            sid: session.sid,
                            expires: session.expires,
                            data: JSON.stringify(session.data),
                        };
                    });
                    servePage(controller, 'profile', data);
                });
            });
            return;
        },
        login: function (controller) {
            (0, exports.checkSession)(controller, function ([Views, User]) {
                controller.res.end('<meta http-equiv="refresh" content="0; url=/profile">');
            }, function () {
                servePage(controller, 'login');
            });
        },
        logon: function (controller) {
            parseForm(controller).then(function ([fields, files]) {
                if (!fields || !fields.Email || !fields.Password) {
                    controller.res.end('<meta http- equiv="refresh" content="0; url=/login">');
                    return;
                }
                const Email = fields.Email;
                const Password = fields.Password;
                const Redirect = fields.Redirect || '/profile';
                controller.db.User.findOne({
                    where: {
                        email: Email,
                    },
                }).then((user) => {
                    if (!user) {
                        controller.res.end('Invalid login, user not found');
                        return;
                    }
                    else if (Password !== user.password) {
                        controller.res.end('Invalid login, password incorrect');
                        return;
                    }
                    else {
                        createSession(user.id, controller).then((session) => {
                            controller.res.end(`<meta http-equiv="refresh" content="0; url=${Redirect}">`);
                            return;
                        });
                    }
                });
            });
        },
        logout: function (controller) {
            const name = controller.name || 'thalia';
            controller.res.setCookie({ [`_${name}_login`]: '' }, new Date(0));
            (0, exports.checkSession)(controller, function ([views, user]) {
                user.logout(controller.cookies[`_${name}_login`]);
                controller.res.end('<meta http-equiv="refresh" content="0; url=/login">');
                return;
            });
        },
        forgotPassword: function (controller) {
            (0, exports.checkSession)(controller, function ([views, user]) {
                controller.res.end('<meta http-equiv="refresh" content="0; url=/profile">');
            }, function () {
                servePage(controller, 'forgotPassword');
            });
        },
        recoverAccount: function (controller) {
            console.log('Someone is trying to recoverAccount');
            var blah = controller.db.Audit.create({
                action: 'recoverAccount',
                ip: controller.ip,
                data: controller.req.headers,
            });
            controller.db.Audit.count({
                where: {
                    action: 'recoverAccount',
                    ip: controller.ip,
                    createdAt: {
                        [sequelize_1.Op.gt]: new Date(Date.now() - 1000 * 60 * 60),
                    },
                },
            }).then((count) => {
                if (count > 5) {
                    controller.res.end('Too many account recovery attempts');
                    return;
                }
                else {
                    parseForm(controller).then(function ([fields, files]) {
                        if (!fields || !fields.Email) {
                            controller.res.end('<meta http-equiv="refresh" content="0; url=/forgotPassword">');
                            return;
                        }
                        const Email = fields.Email;
                        controller.db.User.findOne({
                            where: {
                                email: Email,
                            },
                        }).then((user) => {
                            if (!user) {
                                controller.res.end('User with this email not found');
                                return;
                            }
                            else {
                                createSession(user.id, controller).then((session) => {
                                    const emailOptions = {
                                        from: options.mailFrom,
                                        to: Email,
                                        subject: `Account Recovery for ${options.websiteName}`,
                                        html: `Hi ${user.name},<br>This is an account recovery email. If you have forgotten your password, you can log in using this link: <a href="https://${controller.req.headers.host}/profile?session=${session.sid}">Log in</a> and then reset your password<br>If you did not request this email, please ignore it.`,
                                    };
                                    sendEmail(emailOptions, options.mailAuth);
                                    controller.res.end('Recovery email sent, please check your email');
                                });
                            }
                        });
                    });
                }
            });
        },
        newUser: function (controller) {
            (0, exports.checkSession)(controller, function ([views, user]) {
                controller.res.end('You already have an account.');
            }, function () {
                servePage(controller, 'newUser');
            });
        },
        createNewUser: function (controller) {
            parseForm(controller).then(function ([fields, files]) {
                if (!fields || !fields.Email || !fields.Password || !fields.Captcha) {
                    controller.res.end('<meta http-equiv="refresh" content="0; url=/newUser">');
                    return;
                }
                const Name = fields.Name;
                const Email = fields.Email;
                const Password = fields.Password;
                controller.db.User.findOrCreate({
                    where: {
                        email: Email,
                    },
                    defaults: {
                        name: Name,
                        email: Email,
                        password: Password,
                    },
                }).then(([user, created]) => {
                    if (!created) {
                        controller.res.end('User with this email already exists');
                        return;
                    }
                    else {
                        controller.readAllViews(function (views) {
                            createSession(user.id, controller).then((session) => {
                                loadViewsAsPartials(views, controller.handlebars);
                                const template = controller.handlebars.compile(views.newUserEmail);
                                const data = {
                                    websiteName: options.websiteName,
                                    websiteURL: controller.req.headers.host,
                                    session,
                                };
                                const emailOptions = {
                                    from: options.mailFrom || '"7oclock Co" <7oclockco@gmail.com>',
                                    to: Email,
                                    subject: `New account for ${options.websiteName} created`,
                                    html: template(data),
                                };
                                sendEmail(emailOptions, options.mailAuth);
                                controller.res.end(`<meta http-equiv="refresh" content="0; url=/profile">`);
                                return;
                            });
                        });
                    }
                });
            });
        },
        verifyEmail: function (controller) {
            const query = controller.query;
            console.log('query', query);
            if (query && query.session) {
                controller.db.Session.findOne({
                    where: {
                        sid: query.session,
                    },
                }).then((session) => {
                    if (session) {
                        controller.db.User.update({ verified: true }, { where: { id: session.userId } }).then(() => {
                            controller.res.end('Email verified');
                        });
                    }
                    else {
                        controller.res.end('Email not verified. No session found.');
                    }
                });
            }
            else {
                (0, exports.checkSession)(controller, function ([views, user]) {
                    const name = controller.name || 'thalia';
                    const emailOptions = {
                        from: options.mailFrom,
                        to: user.email,
                        subject: `Verify Email`,
                        html: `Hi ${user.name},<br>Please verify your email address by clicking this link: <a href="https://${controller.req.headers.host}/verifyEmail?session=${controller.cookies[`_${name}_login`]}">Verify Email</a>`,
                    };
                    sendEmail(emailOptions, options.mailAuth);
                    controller.res.end('Verification email sent, please check your email.');
                });
            }
        },
        invite: function (controller) {
            (0, exports.checkSession)(controller, function ([views, user]) {
                if (user.role !== 'admin') {
                    controller.res.end('You are not an admin');
                    return;
                }
                parseForm(controller).then(function ([fields, files]) {
                    console.log('fields', fields);
                    console.log('files', files);
                    controller.res.end('You are logged in: ' + JSON.stringify(user));
                });
                return;
            });
        },
    };
}
exports.users = users;
function servePage(controller, page, data) {
    controller.readAllViews(function (views) {
        loadViewsAsPartials(views, controller.handlebars);
        const template = controller.handlebars.compile(views.wrapper);
        setHandlebarsContent(views[page], controller.handlebars).then(() => {
            const html = template(data || {});
            controller.res.end(html);
        });
    });
}
function parseForm(controller) {
    return new Promise((resolve, reject) => {
        const form = new formidable.Formidable();
        form.parse(controller.req, (err, fields, files) => {
            if (err) {
                console.error('Error', err);
                reject(err);
                return;
            }
            resolve([parseFields(fields), files]);
        });
    });
}
function parseFields(fields) {
    return Object.entries(fields).reduce((obj, [key, value]) => {
        obj[key] = value[0];
        return obj;
    }, {});
}
exports.default = { crud };
const oauthDictionary = {
    '!': '%21',
    '*': '%2A',
    "'": '%27',
    '(': '%28',
    ')': '%29',
    ',': '%2C',
    ':': '%3A',
    ';': '%3B',
    '@': '%40',
    $: '%24',
    '/': '%2F',
    '+': '%2B',
};
function oauthEscape(string) {
    if (string === undefined) {
        return '';
    }
    if (string instanceof Array) {
        throw 'Array passed to _oauthEscape';
    }
    return encodeURIComponent(string).replace(new RegExp(Object.keys(oauthDictionary).join('|'), 'g'), function (match) {
        return oauthDictionary[match];
    });
}
exports.oauthEscape = oauthEscape;
const htmlDictionary = {
    '&': '&amp;',
    ';': '&semi;',
    '<': '&lt;',
    '>': '&gt;',
    '!': '&excl;',
    '=': '&equals;',
    '#': '&num;',
    '%': '&percnt;',
    '\\(': '&lpar;',
    '\\)': '&rpar;',
    '\\*': '&ast;',
    '\\+': '&plus;',
    ',': '&comma;',
    '\\.': '&period;',
    '@': '&commat;',
    '\\[': '&lsqb;',
    '\\': '&bsol;',
    '\\]': '&rsqb;',
    '\\^': '&Hat;',
    '{': '&lcub;',
    '\\|': '&verbar;',
    '}': '&rcub;',
    '~': '&tilde;',
    "'": '&apos;',
    '"': '&quot;',
    '`': '&grave;',
    '’': '&rsquo;',
    '‘': '&lsquo;',
    '“': '&ldquo;',
    '”': '&rdquo;',
    '–': '&ndash;',
    '—': '&mdash;',
    '…': '&hellip;',
    '©': '&copy;',
    '®': '&reg;',
    '™': '&trade;',
    '°': '&deg;',
    µ: '&micro;',
    '½': '&frac12;',
    '¼': '&frac14;',
    '¾': '&frac34;',
};
function htmlEscape(string) {
    if (string === undefined) {
        return '';
    }
    if (string instanceof Array) {
        throw 'Array passed to escapeHtml';
    }
    return string.replace(new RegExp(Object.keys(htmlDictionary).join('|'), 'g'), function (match) {
        return htmlDictionary[match] || htmlDictionary[`\\${match}`];
    });
}
exports.htmlEscape = htmlEscape;
function sortParams(object) {
    const keys = Object.keys(object).sort();
    const result = {};
    keys.forEach(function (key) {
        let value = object[key];
        if (typeof value === 'string') {
            value = htmlEscape(value);
        }
        result[key] = value;
    });
    return result;
}
exports.sortParams = sortParams;
