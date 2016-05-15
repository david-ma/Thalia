var fs = require("fs");
// var db = require("./database").db;
// var cred = require("./credentials").cred;

// var maindb = new db(cred.db);
// var data = {};
// var table = "spotify";

function init(io, handle){
	
	
	//start the heartbeat...
	function sendHeartbeat(){
			setTimeout(sendHeartbeat, 8000);
			io.sockets.emit('drip', { beat : 1 });
	}
	setTimeout(sendHeartbeat, 8000);

	//this stuff happens once, when the server starts:
// 	refresh_data();


	//this stuff happens every time a page is loaded:
	io.on('connection', function(socket){
		//on every connection:

		//heartbeat function to keep connections alive.
    socket.on("drop", function(data){
//       console.log("Drop received from client");
    });
    

	console.log("socket connected at "+socket.id+" "+socket.handshake.address.address+" "+socket.handshake.headers.referer);

		var host = socket.handshake.headers.host;
		var website = handle.getWebsite(host);

		if(website != undefined && website.sockets){
	
			website.sockets.on.forEach(function(d){
				socket.on(d.name, d.callback);
			})

			website.sockets.emit.forEach(function(d){
				socket.emit(d.name, d.data);
			})
		}
	});
}




exports.init = init;
























