var fs = require("fs");
var mime = require('mime');



function router(website, pathname, response, request) {

	var route = new Promise(function(resolve, reject){
		try {
			var data = {
				cookies: {},
				words: []
			};

			request.headers.cookie.split(";").forEach(function(d){
				data.cookies[d.split("=")[0]] = d.substring(d.split("=")[0].length);
			});

			data.words = pathname
				.split("/")
				.map(function(d){
					return d.toLowerCase();
				});

			resolve(data);
		} catch (err){
			reject();
		}

	});

	route.then(function(d){

		// If there's a redirect, go to it
		if(typeof website.redirects[pathname] !== "undefined") {
			redirect(website.redirects[pathname]);

			//	If there's a page, serve it
		} else if(typeof website.pages[d.words[1]] !== "undefined") {
			routeFile(website.folder.concat(website.pages[d.words[1]]));

			//	if there's a function, perform it
		} else if(typeof website.services[d.words[1]] === 'function') {
			website.services[d.words[1]](response, request, website.db, d.words[2]);
		} else {

			// Otherwise, route as normal
			routeFile(website.folder.concat(pathname));
		}
	}).catch(renderError);

	function renderError(d){
		d = d || {
				code: 500,
				message: "Server Error"
			};
		response.writeHead(d.code, {
			"Content-Type": "text/html"
		});
		response.end(d.message);
	}


	function redirect(url){
		if (typeof(url) == "string") {
			console.log("Forwarding user to: "+url);
			response.writeHead(303, {"Content-Type": "text/html"});
			response.end('<meta http-equiv="refresh" content="0; url='+url+'">');
			return;

		} else {
			console.log("Error, url missing");
			response.writeHead(501, {"Content-Type": "text/plain"});
			response.end("501 URL Not Found\n");
			return;
		}
	}

	function routeFile(filename){
		fs.exists(filename, function(exists) {
			if(!exists) {
				console.log("No file found for " + filename);
				response.writeHead(404, {"Content-Type": "text/plain"});
				response.end("404 Page Not Found\n");
				return;
			}

			fs.readFile(filename, "binary", function(err,file) {
				if(err) {

					fs.readdir(filename,function(e,d){
						if(!e && d && d instanceof Array && d.indexOf("index.html") >= 0){
//folder has index.html
//console.log("folder has index");
							if (filename.lastIndexOf("/") == filename.length - 1) {
								routeFile(response, request, filename+"index.html");
								return;
							} else {
								var url = request.url,
									redirect = url+"/";
								if (url.indexOf("?") != -1) {
									var arr = url.split("?");
									redirect = arr[0]+"/?"+arr[1];
								}
								response.writeHead(303, {Location: redirect});
								response.end();
							}
						} else {
//folder without index.html
							console.log("Error 500, content protected? "+filename);
							response.writeHead(500, {"Content-Type": "text/plain"});
							response.end("Error 500, content protected\n"+err);
							return;
						}
					});
				} else {
					fs.stat(filename, function(err, stats){
						if (stats.size > 102400){ //cache files bigger than 100kb?
							//		console.log(stats.size);
							//		console.log(filename +" is a big file! Caching!");
							if (!response.getHeader('Cache-Control') || !response.getHeader('Expires')) {
								response.setHeader("Cache-Control", "public, max-age=345600"); // ex. 4 days in seconds.
								response.setHeader("Expires", new Date(Date.now() + 345600000).toUTCString());  // in ms.
							}
						}
						response.writeHead(200, {'Content-Type': mime.lookup(filename)});
						response.end(file, "binary");
					});
				}
			});
		});
	}
}


exports.router = router;
//exports.routeFile = routeFile;








