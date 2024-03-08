"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const thalia_1 = require("thalia");
const cred_1 = require("./cred");
const securityOptions = {
    websiteName: 'default',
    mailFrom: 'Thalia <thalia@david-ma.net>',
    mailAuth: cred_1.cred.mailAuth,
};
exports.config = {
    domains: [],
    data: false,
    dist: false,
    controllers: {
        ...(0, thalia_1.users)(securityOptions),
    },
};
