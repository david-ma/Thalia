var fs = require("fs");
var db = require("./database").db;
var cred = require("./credentials").cred;

var maindb = new db(cred.db);
var data = {};

function init(io, handle){
	

	//this stuff happens once, when the server starts:
	refresh_data();


	//this stuff happens every time a page is loaded:
	io.on('connection', function(socket){

		//on every connection:
	console.log("socket connected at "+socket.id+" "+socket.handshake.address.address+" "+socket.handshake.headers.referer);

	socket.on("refresh", function(){
		refresh_data();




		socket.emit("refreshed", data);
	});


	socket.emit("hello", data)

	});
}

function refresh_data(){
	console.log("Refreshing spotify data from database into memory");

	maindb.query("select * from spotify;", function(d){
		data = {
			threads: d
		}
	})


}




exports.init = init;
























