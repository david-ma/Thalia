var server = require("./server");
var router = require("./router");
var socket = require("./socket");
var requestHandlers = require("./requestHandlers");

var listOfAlbums = null;

var handle = {}
handle["/"] = requestHandlers.home;
handle["/reddit/questions"] = requestHandlers.redditQuestions;
handle["/reddit/albums"] = requestHandlers.redditAlbums;
handle["/reddit/anything"] = requestHandlers.redditAnything;
handle["/reddit/howto"] = requestHandlers.redditHowTo;
handle["/reddit/raw"] = requestHandlers.redditRaw;
handle["/reddit/oldraw"] = requestHandlers.redditOldRaw;
handle["/reddit/websites"] = requestHandlers.redditWebsites;
handle["/reddit/gear"] = requestHandlers.redditGear;
handle["/reddit/inspiration"] = requestHandlers.redditInspiration;

var s = server.start(router.route, handle, parseInt(process.argv[2]));

var io = require('socket.io').listen(s, {log:false});

socket.init(io);







