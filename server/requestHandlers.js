var socket = require("./socket");
var db = require("./database").db;
var router = require("./router");


var Website = function (data) {
	if(typeof data == "object" && typeof data.folder == "string") {
		this.folder = data.folder;
		this.domains = typeof data.domains == "object" ? data.domains : [];
		this.pages = typeof data.pages == "object" ? data.pages : {"/": "index.html"};
		this.redirects = typeof data.redirects == "object" ? data.redirects : {};
		this.services = typeof data.services == "object" ? data.services : {};
		this.sockets = typeof data.sockets == "object" ? data.sockets : {emit:{}, on:{}};
	} else {
		console.log("Error, folder should be a string");
	}
}

var handle = {
	websites: {},
	index: {localhost: 'default'},
	addWebsite: function(data){
		handle.websites[data.folder] = new Website(data);

		handle.websites[data.folder].domains.forEach(function(domain){
			handle.index[domain] = data.folder;
		})

	},
	getWebsite: function(domain){
		var folder = typeof handle.index[domain] == "undefined" ? "default" : handle.index[domain];

		return handle.websites[folder];
	}
};

handle.addWebsite({
	folder: "default",
	domains: [""]
})

handle.addWebsite({
	folder: "reddit",
	domains: ["localhost"],
	sockets: {
		emit: {},
		on: {
			threads: function(){
				console.log("heeey!");
			}
		}
	}
})

exports.handle = handle;






























