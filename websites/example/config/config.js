"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const thalia_1 = require("thalia");
const securityOptions = {
    websiteName: 'default',
    mailFrom: 'Thalia <thalia@david-ma.net>',
    mailAuth: {
        user: '',
        pass: '',
    },
};
securityOptions.mailAuth = require('./cred.js').mailAuth;
exports.config = {
    domains: [],
    data: false,
    dist: false,
    controllers: {
        ...(0, thalia_1.users)(securityOptions),
    },
};
