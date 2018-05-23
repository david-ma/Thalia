////////////////////
// INIT GREENLOCK //
////////////////////

const path = require('path');
const os = require('os');
const Greenlock = require('greenlock');
const http = require('http');

const handle = require("./requestHandlers").handle;
handle.loadAllWebsites();

const domainSet = {"server.david-ma.net": true, "localhost": false};
Object.keys(handle.index).forEach((domain) => domainSet[domain] = true);
Object.keys(handle.proxies).forEach((domain) => domainSet[domain] = true);

delete domainSet.localhost;
const allDomains = Object.keys(domainSet);

console.log("Registering SSL for these domains:", allDomains);

const greenlock = Greenlock.create({
    agreeTos: true                      // Accept Let's Encrypt v2 Agreement
    , email: 'greenlock@david-ma.net'           // IMPORTANT: Change email and domains
    , approveDomains: allDomains
    // , approveDomains: [ 'david-ma.net']
    , communityMember: false              // Optionally get important updates (security, api changes, etc)
                                          // and submit stats to help make Greenlock better
    , version: 'draft-11'
    , server: 'https://acme-v02.api.letsencrypt.org/directory'
    , configDir: path.join(os.homedir(), 'acme/etc')
});

////////////////////
// CREATE SERVERS //
////////////////////

const redir = require('redirect-https')();
http.createServer(greenlock.middleware(redir)).listen(80);

const server = require("./server");
const router = require("./router");
const socket = require("./socket");

const s = server.start(router.router, handle, greenlock.tlsOptions);
const io = require('socket.io').listen(s, {log:false});
socket.init(io, handle);





