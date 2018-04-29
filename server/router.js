var fs = require("fs");
var mime = require('mime');
var zlib = require('zlib');

/**
 * The router should check what sort of route we're doing, and act appropriately.
 * Check:
 * - Security
 * - Redirects to outside websites
 * - Internal page alias
 * - Services / functions
 * - /data/ folder might have a file
 * - otherwise, we serve the file normally
 *
 * - When serving the file normally, we need to check the header to see if it can be zipped or should be zipped.
 */
function route(website, pathname, response, request) {
	var first, second;
	try {
		first = pathname.split("/")[1].toLowerCase();
	} catch (err){}
	try {
		second = pathname.split("/")[2].toLowerCase();
	} catch (err){}

	if(typeof website.redirects[pathname] !== "undefined") {
		redirect(response, request, website.redirects[pathname]);
	} else if(typeof website.pages[first] !== "undefined") {
		routeFile(response, request, website.folder.concat(website.pages[first]));
	} else if(typeof website.services[first] === 'function') {
		website.services[first](response, request, website.db, second);
	} else if(website.data && fs.existsSync(website.data.concat(pathname.replace("data/", "")))) {
		routeFile(response, request, website.data.concat(pathname.replace("data/", "")));
	} else if(website.data && fs.existsSync(website.data.concat(pathname.replace("data/", "")).concat(".gz"))) {
		response.setHeader('Content-Encoding', 'gzip');
		routeFile(response, request, website.data.concat(pathname.replace("data/", "")).concat(".gz"));
	} else {
		routeFile(response, request, website.folder.concat(pathname));
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

/**
 * Given a filename, serve it.
 *
 * Check that the file exists
 * Check the headers..?
 * zip/unzip if needed
 *
 * @param filename
 */
function routeFile(response, request, filename){
	fs.exists(filename, function(exists) {
		if(!exists) {
			console.log("No file found for " + filename);
			response.writeHead(404, {"Content-Type": "text/plain"});
			response.end("404 Not Found\n");
			return;
		}

        var filetype = mime.lookup(filename);
        var acceptedEncoding = request.headers['accept-encoding'];

        var router = function(file) {
            response.writeHead(200, {'Content-Type': filetype});
            response.end(file, "binary");
        };

        fs.stat(filename, function(err, stats){
            // Only zip stuff if it's bigger than 1400 bytes
            if (stats.size > 1400) {
                if (filetype.slice(0,4) === "text") {
                    if(acceptedEncoding.indexOf('deflate') >= 0) {
                        router = function(file) {
                            response.writeHead(200, { 'content-encoding': 'deflate' });
                            zlib.deflate(file, function(err, result){
                                response.end(result);
                            });
                        };
                    } else if(acceptedEncoding.indexOf('gzip') >= 0) {
                        router = function(file) {
                            response.writeHead(200, { 'content-encoding': 'gzip' });
                            zlib.gzip(file, function(err, result){
                                response.end(result);
                            });
                        };
                    }
                }

                if (stats.size > 102400){ //cache files bigger than 100kb?
                    //		console.log(stats.size);
                    //		console.log(filename +" is a big file! Caching!");
                    if (!response.getHeader('Cache-Control') || !response.getHeader('Expires')) {
                        response.setHeader("Cache-Control", "public, max-age=604800"); // ex. 7 days in seconds.
                        response.setHeader("Expires", new Date(Date.now() + 604800000).toUTCString());  // in ms.
                    }
                } else {
                    // Cache smaller things for 3 mins?
                    // Alternative is to use no-cache?
                    // Probably should read this: https://jakearchibald.com/2016/caching-best-practices/
                    if (!response.getHeader('Cache-Control') || !response.getHeader('Expires')) {
                        response.setHeader("Cache-Control", "public, max-age=180"); // ex. 7 days in seconds.
                        response.setHeader("Expires", new Date(Date.now() + 180000).toUTCString());  // in ms.
                    }
                }
            }
        });

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
				router(file);
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








