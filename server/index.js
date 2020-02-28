const server = require("./server");
const router = require("./router").router;
const handle = require("./requestHandlers").handle;

const start = Date.now();

handle.loadAllWebsites();
server.start(router, handle);

console.log(`${Date.now() - start} ms - Total Thalia startup`);
