var db = require("./database").db;
var cred = require("./credentials").cred;

var util = require('util'),
    querystring = require('querystring');

var site = {
	folder: "dist",
	domains: ["localhost"],
	services: {},
	sockets: {
		emit: {},
		on: {
			threads: function(){
				console.log("heeey!");
			}
		}
	}
}


var scopes = "user-read-private user-read-email playlist-read-private	playlist-read-collaborative	user-top-read"



var spotify = {
	init: function(){
		
	}
}

exports.spotify = spotify;

exports.site = site;


