"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validURL = exports.checkLinks = exports.getLinks = exports.asyncForEach = void 0;
const http = require("http");
const https = require("https");
const xray = require('x-ray')();
const jestConfig = require('../jest.config');
const jestURL = jestConfig.globals.URL;
// Asynchronous for each, doing a limited number of things at a time. Pool of resources.
async function asyncForEach(array, callback, limit = 5) {
    return new Promise((resolve) => {
        let i = 0;
        let happening = 0;
        const errorMessages = [];
        for (; i < limit; i++) {
            // Launch a limited number of things
            happening++;
            doNextThing(i);
        }
        function doNextThing(index) {
            // Each thing calls back "done" and starts the next
            if (array[index]) {
                callback(array[index], function done(message) {
                    if (message)
                        errorMessages.push(message);
                    doNextThing(i++);
                }, index, array);
            }
            else {
                happening--; // When they're all done, resolve
                if (happening === 0)
                    resolve(errorMessages);
            }
        }
    });
}
exports.asyncForEach = asyncForEach;
async function getLinks(site, page = '') {
    // console.log(`Getting links on ${site} - ${URL} - ${page}`)
    return new Promise((resolve, reject) => {
        http
            .get(`${jestURL}/${page}`, {
            headers: {
                'x-host': `${site}.com`,
            },
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
    return new Promise((resolve, reject) => {
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
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.36',
                    },
                }, function (response) {
                    // TODO: Follow 3xx links and see if they're valid?
                    const allowedStatusCodes = [200, 301, 302, 303, 307, 999];
                    response.on('end', function () {
                        if (allowedStatusCodes.indexOf(response.statusCode) === -1) {
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
            reject(e);
        });
    });
}
exports.checkLinks = checkLinks;
function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}
exports.validURL = validURL;
