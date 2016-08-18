var db = require("./database").db;

var Website = function (site, config) {
	if(typeof config == "object") {
		this.folder = typeof config.folder == "string" ? config.folder : "websites/"+site+"/public";
		this.domains = typeof config.domains == "object" ? config.domains : [];
		this.pages = typeof config.pages == "object" ? config.pages : {"": "/index.html"};
		this.redirects = typeof config.redirects == "object" ? config.redirects : {};
		this.services = typeof config.services == "object" ? config.services : {};
		this.sockets = typeof config.sockets == "object" ? config.sockets : {emit:[], on:[]};
		this.proxies = typeof config.proxies == "object" ? config.proxies : {};
	} else {
		console.log("Config isn't an object");
	}
}

var handle = {
	websites: {},
	index: {localhost: 'default'},
	
	// Add a site to the handle
	addWebsite: function(site, config, cred){
		console.log("Adding site: "+site);

		config = config || {};		
		handle.websites[site] = new Website(site, config);
		
		Object.keys(handle.websites[site].proxies).forEach(function(proxy){
		  handle.proxies[proxy] = handle.websites[site].proxies[proxy];
		});

		// Add the site to the index
		handle.index[site+".com"] = site;
		handle.index[site+".net"] = site;
		handle.index[site+".localhost"] = site;
		handle.index[site+".david-ma.net"] = site;
		handle.websites[site].domains.forEach(function(domain){
			handle.index[domain] = site;
		});

		// If DB credentials are provided, connect to the db and add to the site handle
		if(cred) {
			handle.websites[site].db = new db(cred);
		}

		// If the site has any startup actions, do them
		if(config.startup){
			config.startup.forEach(function(action){
				action(handle.websites[site]);
			});
		}
	},
	getWebsite: function(domain){
		console.log("Domain: "+domain);
		var domain = domain.replace("www.","");	
		var site = typeof handle.index[domain] == "undefined" ? handle.index.localhost : handle.index[domain];
		return handle.websites[site];
	},
	proxies: {}
};

handle.addWebsite("default", {});

exports.handle = handle;


































































