var fs = require("fs");
var db = require("./database").db;
var cred = require("./credentials").cred;

var maindb = new db(cred.db);
var reddit_data = {};

function init(io, handle){
	

	//this stuff happens once, when the server starts:
	refresh_redit_data();


	//this stuff happens every time a page is loaded:
	io.on('connection', function(socket){

		//on every connection:
	console.log("socket connected at "+socket.id+" "+socket.handshake.address.address+" "+socket.handshake.headers.referer);

	socket.on("refresh", function(){
		refresh_redit_data();




		socket.emit("refreshed", reddit_data);
	});


	socket.emit("hello", reddit_data)

	});
}

function refresh_redit_data(){
	console.log("Refreshing reddit data from database into memory");

	maindb.query("select * from reddit_photo_threads;", function(d){
		reddit_data = {
			threads: d
		}
	})


}




exports.init = init;
























