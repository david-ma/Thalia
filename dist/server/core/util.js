"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBoolean = exports.parseForm = exports.sortParams = exports.oauthEscape = exports.htmlEscape = exports.merge = void 0;
const formidable_1 = __importDefault(require("formidable"));
/**
 * Deep merges two objects, similar to lodash's merge
 */
function merge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                }
                else {
                    output[key] = merge(target[key], source[key]);
                }
            }
            else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}
exports.merge = merge;
/**
 * Checks if a value is a plain object
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}
/**
 * Escapes HTML special characters in a string
 */
function htmlEscape(string) {
    return string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
exports.htmlEscape = htmlEscape;
/**
 * Escapes OAuth special characters in a string
 */
function oauthEscape(string) {
    return string
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
}
exports.oauthEscape = oauthEscape;
/**
 * Sorts object parameters alphabetically by key
 */
function sortParams(object) {
    return Object.keys(object)
        .sort()
        .reduce((result, key) => {
        result[key] = object[key];
        return result;
    }, {});
}
exports.sortParams = sortParams;
/**
 * Parses form data from a request
 */
function parseForm(controller) {
    return new Promise((resolve, reject) => {
        const form = (0, formidable_1.default)();
        form.parse(controller.req, (err, fields, files) => {
            if (err)
                reject(err);
            resolve([parseFields(fields), files]);
        });
    });
}
exports.parseForm = parseForm;
/**
 * Parses form fields from array format to single values
 */
function parseFields(fields) {
    return Object.entries(fields).reduce((result, [key, value]) => {
        result[key] = Array.isArray(value) ? value[0] : value;
        return result;
    }, {});
}
/**
 * Parses a boolean string value
 */
function parseBoolean(string) {
    if (typeof string === 'boolean')
        return string;
    if (typeof string !== 'string')
        return false;
    return string.toLowerCase() === 'true';
}
exports.parseBoolean = parseBoolean;
//# sourceMappingURL=util.js.map