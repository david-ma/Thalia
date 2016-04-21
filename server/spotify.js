var db = require("./database").db;
var cred = require("./credentials").cred.spotify;

var util = require('util'),
    querystring = require('querystring'),
		Auth = require("./auth").Auth;

var auth = new Auth(cred);


var site = {
	folder: "dist",
	domains: ["localhost"],
	services: {
		login: function(res, req, extra){auth.login(res, req, extra)},
		callback: function(res, req, extra){auth.callback(res, req, extra)},
		post: function(res, req, extra){auth.post(res, req, extra)}		
	},
	sockets: {
		emit: {},
		on: {
			threads: function(){
				console.log("heeey!");
			}
		}
	}
}








exports.site = site;


