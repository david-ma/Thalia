var fs = require("fs");
// var db = require("./database").db;
// var cred = require("./credentials").cred;

// var maindb = new db(cred.db);
// var data = {};
// var table = "spotify";

function init(io, handle){
	

	//this stuff happens once, when the server starts:
// 	refresh_data();


	//this stuff happens every time a page is loaded:
	io.on('connection', function(socket){
		//on every connection:
	console.log("socket connected at "+socket.id+" "+socket.handshake.address.address+" "+socket.handshake.headers.referer);

	var host = socket.handshake.headers.host;
	var website = handle.getWebsite(host);

	if(website != undefined && website.sockets){
				console.log("heeeey");
		website.sockets.on.forEach(function(d){
			socket.on(d.name, d.callback);
		})
		website.sockets.emit.forEach(function(d){
			socket.emit(d.name, d.data);
		})
	}



// 
// 	socket.on("refresh", function(){
// 		refresh_data();
// 
// 		socket.emit("refreshed", data);
// 	});
// 
// 	socket.emit("hello", data)
	});
	
	
	}

// 
// function refresh_data(){
// 	console.log("Refreshing data from '"+table+"' into memory");
// 
// 	maindb.query("select * from "+table+";", function(d){
// 		data = {
// 			table: table,
// 			rows: d
// 		}
// 	})
//}




exports.init = init;
























