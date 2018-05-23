const server = require("./server");
const router = require("./router");
const socket = require("./socket");
const handle = require("./requestHandlers").handle;

handle.loadAllWebsites();
const s = server.start(router.router, handle);
const io = require('socket.io').listen(s, {log:false});
socket.init(io, handle);
