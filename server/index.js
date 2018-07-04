const server = require("./server");
const router = require("./router");
const handle = require("./requestHandlers").handle;

handle.loadAllWebsites();
server.start(router.router, handle);
