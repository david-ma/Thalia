var table = "panel";



var Database = require("./database").db;
var cred = require("./credentials").cred;

var util = require('util'),
    querystring = require('querystring');

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

		]
	}
}


db.query("select * from "+table+";", function(d){
	site.sockets.emit.push({
		name: "table_data",
		data: d		
	})
})





exports.site = site;








