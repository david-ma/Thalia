var fs = require("fs");
var db = require("./database").db;
var cred = require("./credentials").cred;

var maindb = new db(cred.db);
var data = {};
var table = "spotify";

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
	console.log("Refreshing data from '"+table+"' into memory");

	maindb.query("select * from "+table+";", function(d){
		data = {
			table: table,
			rows: d
		}
	})


}




exports.init = init;
























