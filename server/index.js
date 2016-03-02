var server = require("./server");
var router = require("./router");
var socket = require("./socket");
var handle = require("./requestHandlers").handle;

var index = {
	init: function(){
		var s = server.start(router.route, handle);
		var io = require('socket.io').listen(s, {log:false});
		socket.init(io, handle);
	}
}
index.init();