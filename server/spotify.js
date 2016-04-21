var Database = require("./database").db;
var cred = require("./credentials").cred;

var util = require('util'),
    querystring = require('querystring'),
		Auth = require("./auth").Auth;

var auth = new Auth(cred.spotify);
var db = new Database(cred.local);



var site = {
	folder: "dist",
	domains: ["localhost"],
	services: {
// Don't worry about auth stuff for now...	
// 		login: function(res, req, extra){auth.login(res, req, extra)},
// 		callback: function(res, req, extra){auth.callback(res, req, extra)},
// 		post: function(res, req, extra){auth.post(res, req, extra)}		
	},
	sockets: {
		emit: [
// 		{
// 			name: 'spotify_data',
// 			data: data
// 		}
		],
		on: [
		
//		This was a helper function to load data into the database;
// 		{
// 			name: 'helper',
// 			callback: function(d){
// 				console.log("hey, doing something once");
// 
// 				data.tracks.items.forEach(function(d){
// 					var stuff = {
// 						added_at		: d.added_at,
// 						added_by		: d.added_by.id,
// 						album_name	: d.track.album.name,
// 						album_id 		: d.track.album.id,
// 						artist_name : d.track.artists[0].name,
// 						artist_id 	: d.track.artists[0].id,
// 						duration_ms : d.track.duration_ms,
// 						song_id 		: d.track.id,
// 						song_name 	: d.track.name
// 				// 		release_date = null;
// 					}
// 					db.insert("spotify", stuff, function(d){
// 						console.log("success for "+stuff.song_name);
// 					})
// 				})
// 			}
// 		}
		]
	}
}


db.query("select * from spotify;", function(d){
	site.sockets.emit.push({
		name: 'spotify_data',
		data: d		
	})
})





exports.site = site;








