var path = require("path");
var fs = require("fs");
var requestHandlers = require("./requestHandlers");
var mime = require('mime');
var db = require("./database").db;

function route(handle, pathname, response, request) {
	console.log(pathname);
//	console.log(pathname.split("/"));

	console.log(request.headers.host);

	var website = handle.getWebsite(request.headers.host);
	//website has, folder, domains, pages and services...

	//check for services...
	if(typeof pathname.split("/")[1] != 'undefined' &&
		 typeof website.services[pathname.split("/")[1].toLowerCase()] === 'function') {
		 
	website.services[pathname.split("/")[1].toLowerCase()](response, request, pathname.split("/")[2]);

	} else if(typeof website.redirects[pathname] != "undefined") {
		redirect(response, request, website.redirects[pathname]);
	} else if(typeof website.pages[pathname] != "undefined") {
		routeFile(response, request, website.folder.concat("/", website.pages[pathname]));
	} else {
		routeFile(response, request, path.join(process.cwd(), website.folder.concat("/", pathname)));
	}
}

function redirect(response, request, url){
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

function routeFile(response, request, filename){
	fs.exists(filename, function(exists) {
		if(!exists) {
			console.log("No file found for " + filename);
			response.writeHead(404, {"Content-Type": "text/plain"});
			response.end("404 Not Found\n");
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
							response.writeHead(303, {Location: redirect})
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

function isPhoto(file){
	var result = false;
	var end = file.substring(file.lastIndexOf('.'),file.length).toLowerCase();

	if (end == '.jpg' ||
			end == '.jpeg' ||
			end == '.png' ||
			end == '.gif' ||
			end == '.bmp') {
		result = true;
	}
	
	return result;
}

exports.route = route;
exports.routeFile = routeFile;








