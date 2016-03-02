var fs = require("fs");
var db = require("./database").db;

function init(io, handle){
	

	//this stuff happens once, when the server starts:

	//this stuff happens every time a page is loaded:
	io.on('connection', function(socket){

		//on every connection:
	console.log("socket connected at "+socket.id+" "+socket.handshake.address.address+" "+socket.handshake.headers.referer);

	});
}






exports.init = init;
























