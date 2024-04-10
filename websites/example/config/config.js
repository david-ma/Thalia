"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../server/helpers");
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
        ...(0, helpers_1.users)(securityOptions),
    },
};
