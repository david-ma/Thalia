"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPackage = exports.hello = void 0;
const fs = require('fs');
function hello() {
    console.log("hello world");
}
exports.hello = hello;
function checkPackage() {
    fs.readFile('package.json', 'utf8', function (err, data) {
        console.log(data);
    });
}
exports.checkPackage = checkPackage;
exports.default = { hello, checkPackage };
