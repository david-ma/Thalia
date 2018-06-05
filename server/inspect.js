// We should probably write proper tests here.

const handle = require("./requestHandlers").handle;

handle.loadAllWebsites();

console.log("Sites that use websockets:");
Object.keys(handle.websites).forEach(function(site){
    "use strict";

    const sockets = handle.websites[site].sockets;
    if (sockets.emit.length > 0 || sockets.on.length > 0) {
        console.log(site);
        console.log(sockets);
    }

});

console.log("Sites with proxies:");
console.log(Object.keys(handle.proxies));
