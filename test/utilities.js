"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validURL = exports.checkLinks = exports.getLinks = exports.asyncForEach = void 0;
const http = require("http");
const https = require("https");
const xray = require('x-ray')();
const jestConfig = require('../jest.config');
const jestURL = jestConfig.globals.URL;
async function asyncForEach(array, callback, limit = 5) {
    return await new Promise((resolve) => {
        let i = 0;
        let happening = 0;
        const errorMessages = [];
        for (; i < limit; i++) {
            happening++;
            doNextThing(i);
        }
        function doNextThing(index) {
            if (array[index]) {
                callback(array[index], function done(message) {
                    if (message)
                        errorMessages.push(message);
                    doNextThing(i++);
                }, index, array);
            }
            else {
                happening--;
                if (happening === 0)
                    resolve(errorMessages);
            }
        }
    });
}
exports.asyncForEach = asyncForEach;
async function getLinks(site, page = '') {
    return await new Promise((resolve, reject) => {
        http
            .get(`${jestURL}/${page}`, {
            headers: {
                'x-host': `${site}.com`
            }
        }, function (res) {
            let rawData = '';
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            res.on('end', () => {
                xray(rawData, ['a@href'])
                    .then(function (links) {
                    if (links) {
                        resolve(links);
                    }
                    else {
                        resolve([]);
                    }
                })
                    .catch((err) => {
                    reject(err);
                });
            });
        })
            .on('error', (error) => {
            throw error;
        });
    });
}
exports.getLinks = getLinks;
async function checkLinks(site, links) {
    return await new Promise((resolve, reject) => {
        asyncForEach(links, function (link, done) {
            let requester = http;
            if (link.match(/^https/gi)) {
                requester = https;
            }
            try {
                requester
                    .get(link, {
                    timeout: 2000,
                    headers: {
                        'x-host': `${site}.com`,
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.36'
                    }
                }, function (response) {
                    const allowedStatusCodes = [200, 301, 302, 303, 307, 999];
                    response.on('end', function () {
                        if (!allowedStatusCodes.includes(response.statusCode)) {
                            done(`${response.statusCode} - ${link}`);
                        }
                        else {
                            done();
                        }
                    });
                    response.on('data', function (chunk) { });
                    response.on('error', function (e) {
                        done(`${e.message} - ${link}`);
                    });
                })
                    .on('error', (e) => {
                    done(`${e.message} - ${link}`);
                });
            }
            catch (e) {
                done(`${e.message} - ${link}`);
            }
        })
            .then((errors) => {
            if (errors.length > 0) {
                reject(errors);
            }
            else {
                resolve('okay?');
            }
        })
            .catch((e) => {
            reject(e.message);
        });
    });
}
exports.checkLinks = checkLinks;
function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' +
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
        '((\\d{1,3}\\.){3}\\d{1,3}))' +
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
        '(\\?[;&a-z\\d%_.~+=-]*)?' +
        '(\\#[-a-z\\d_]*)?$', 'i');
    return !!pattern.test(str);
}
exports.validURL = validURL;
