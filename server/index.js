var server = require("./server");
var router = require("./router");
var socket = require("./socket");
var handle = require("./requestHandlers").handle;
var fs = require('fs');


var index = {
	init: function(){
		var s = server.start(router.route, handle);
		var io = require('socket.io').listen(s, {log:false});
		socket.init(io, handle);

	},
	loadWebsites: function (){
		let developing = "";
        const pattern = /^\d{0,5}$/;

        // To do: we should check that the workspace exists, otherwise leave it as default
        if (process.argv[2] !== null && process.argv[2] !== undefined && !pattern.exec(process.argv[2])) {
            developing = process.argv[2];
        } else if(typeof process.argv[3] !== null && process.argv[3] !== undefined && !pattern.exec(process.argv[3])){
            developing = process.argv[3];
        }

		if(developing) {
			console.log("Only load %s", developing);
			var site = developing;
            console.log("Adding site: "+site);
            var config, cred;
            try {
                config = require('../websites/'+site+'/config').config;
            } catch (err){
                if(err.code !== 'MODULE_NOT_FOUND') {
                    console.log("Warning, your config script for "+site+" is broken!");
                    console.log();
                }
            }
            try {
                cred = JSON.parse(fs.readFileSync('websites/'+site+'/cred.json'));
            } catch (err){}
            handle.addWebsite(site, config, cred);
		} else {
			fs.readdirSync('websites/').forEach(function(site){
				if(fs.lstatSync('websites/'+site).isDirectory()) {
					console.log("Adding site: "+site);
					var config, cred;
					try {
						config = require('../websites/'+site+'/config').config;
					} catch (err){
						if(err.code !== 'MODULE_NOT_FOUND') {
							console.log("Warning, your config script for "+site+" is broken!");
							console.log();
						}
					}
					try {
						cred = JSON.parse(fs.readFileSync('websites/'+site+'/cred.json'));
					} catch (err){}
					handle.addWebsite(site, config, cred);
				}
			});
        }
    }
};

index.loadWebsites();
index.init();


