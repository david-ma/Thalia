// index.ts
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require:any) {
    require(['server','router','requestHandlers'],
    function(server:any, router:any, requestHandlers:any) {
        requestHandlers.handle.loadAllWebsites();
        server.start(router.router, requestHandlers.handle);
    });
});
