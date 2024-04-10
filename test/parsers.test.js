"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const helpers_1 = require("../server/helpers");
(0, globals_1.describe)('Test htmlEscape', () => {
    (0, globals_1.test)('htmlEscape', () => {
        (0, globals_1.expect)(helpers_1.htmlEscape).toBeTruthy();
    });
});
