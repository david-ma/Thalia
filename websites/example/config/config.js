"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const thalia_1 = require("thalia");
exports.config = {
    domains: ['www.yourwebsite.com'],
    controllers: {
        ...(0, thalia_1.users)({})
    },
};
