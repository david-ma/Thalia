var last_time = 0;
var m0_data = {};
var last_checked = {};
var scrapbook = {};
var fs = require("fs");
var wait_time = 900000; //15 minutes in milliseconds
var db = require("./database").db;
var STORIES = 2900;

var twit = require("./twitter").twit;


function init(io){
	db.init();

	//this stuff happens once, when the server starts:

	//this stuff happens every time a page is loaded:
	io.on('connection', function(socket){
		//on every connection:
	console.log("socket connected at "+socket.id+" "+socket.handshake.address.address+" "+socket.handshake.headers.referer);
//	console.log();
	//socket.close();
		// pass data from memory. Then update memory from google doc.
		// data is loaded from local when server is started,
		// and saved to local every time it is loaded from google.



		socket.on("twit", function(d){
			twit.arbitrary_to_database(d, function(result){
				socket.emit("twitback", result);
			});
		});

		socket.on("twitter_oneoff", function(d){
			twit.oneoff();
		});



		socket.on("get_stories", function(d){
			var n = d.amount;
			var result = {
				stories: []
			};

			for(var i = 0; i < n; i++){
			
				var j = Math.floor(Math.random() * STORIES);
				db.get_row( j, function(d){
					result.stories.push(d[0]);
					socket.emit("stories", result);
				});
				console.log(result.stories);
			}

		})





		function get_row(d){
			var number = Math.floor(Math.random() * STORIES);
			if (typeof d != 'undefined' && d.number != 'undefined'){
				number = d.number;
			}

			db.get_row(number, function(d){
				if(typeof d == 'undefined'){
					get_row();
				} else {
					console.log(d);
					socket.emit("row", d[0]);
				}
			});

		}

		socket.on("get_row", get_row)

		socket.on("random8", function(d){
//			get
		})

		socket.on("getdescription", function(d){
			if(typeof d != "undefined" && d.key != "undefined") {
				var key = d.key;
				db.get_desc(key, function(d){
console.log("here is the callback");
console.log(d);

				});
				
				
			}
		})

	});
}





exports.init = init;
























