// We should probably write proper tests here.

const handle = require("./requestHandlers").handle;
const fs = require('fs');

handle.loadAllWebsites();

let srcWebsites = [];

console.log("Sites that use websockets:");
Object.keys(handle.websites).forEach(function(site){
    "use strict";

    const sockets = handle.websites[site].sockets;
    if(sockets && sockets.emit && sockets.on) {
        if (sockets.emit.length > 0 || sockets.on.length > 0) {
            console.log(site);
            console.log(sockets);
        }
    }

    if(fs.existsSync(`websites/${site}/src`)) {
        srcWebsites.push(site);
    }

    if(handle.websites[site].pages) {
        console.log(handle.websites[site].pages);
    }

});

console.log("Sites with proxies:");
console.log(Object.keys(handle.proxies));

console.log("Sites that use src:");
console.log(srcWebsites);

// console.log(handle.websites);

