const fs = require("fs");
const mime = require('mime');
const zlib = require('zlib');
const parse = require('csv-parse');

function router(website, pathname, response, request) {

    response.setHeader("Access-Control-Allow-Origin", "*");

    const route = new Promise(function(resolve, reject){
        try {
            const data = {
                cookies: {},
                words: []
            };

            if(request.headers.cookie) {
                request.headers.cookie.split(";").forEach(function(d){
                    data.cookies[d.split("=")[0].trim()] = d.substring(d.split("=")[0].length+1).trim();
                });
            }

            data.words = pathname
                .split("/");
                // This should not be lowercase??? Keys are case sensitive!
                // .map(function(d){
                //     return d.toLowerCase();
                // });

            resolve(data);
        } catch (err){
            console.log(err);
            reject(err);
        }

    });

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
    route.then(function(d) {
        if (typeof website.security !== "undefined" && website.security.loginNeeded(pathname, website.db, d.cookies)){
            website.services.login(response, request, website.db);

        } else {

            // If a page substitution exists, substitute it.
            if (typeof website.pages[d.words[1]] !== "undefined") {
                pathname = website.pages[d.words[1]];
            }

            // If there's a redirect, go to it
            if (typeof website.redirects[pathname] !== "undefined") {
                redirect(website.redirects[pathname]);

                //	if there's a controller, call it
            } else if (typeof website.controller[d.words[1]] === 'function') {
                website.controller[d.words[1]]({
                    res: {
                        end: function(result){
                            const acceptedEncoding = request.headers['accept-encoding'] || "";
                            var input = new Buffer(result, 'utf8');
                            response.writeHead(200, { 'content-encoding': 'deflate' });
                            if(acceptedEncoding.indexOf('deflate') >= 0) {
                                zlib.deflate(input, function(err, result){
                                    response.end(result);
                                });
                            } else if(acceptedEncoding.indexOf('gzip') >= 0) {
                                zlib.gzip(input, function(err, result){
                                    response.end(result);
                                });
                            } else {
                                response.end(result);
                            }
                        }
                    },
                    req: request,
                    db: website.db || website.seq || null,
                    path: d.words.slice(2)
                });

                //	if there's a function, perform it
            } else if (typeof website.services[d.words[1]] === 'function') {
                website.services[d.words[1]](response, request, website.db || website.seq , d.words[2]);

                // if there is a matching data file
            } else if (website.data
                        && fs.existsSync(website.data.concat(pathname))
                        && fs.lstatSync(website.data.concat(pathname)).isFile()) {
                routeFile(website.data.concat(pathname));

                // if there is a matching .gz file in the data folder
            } else if (website.data
                        && fs.existsSync(website.data.concat(pathname).concat(".gz"))) {
                response.setHeader('Content-Encoding', 'gzip');
                routeFile(website.data.concat(pathname, ".gz"));

                // if there is a matching compiled file
            } else if (website.dist 
                && fs.existsSync(website.dist.concat(pathname))
                && fs.lstatSync(website.dist.concat(pathname)).isFile()
            || website.dist
                && fs.existsSync(website.dist.concat(pathname, "/index.html"))
                && fs.lstatSync(website.dist.concat(pathname, "/index.html")).isFile()
            ) {
                routeFile(website.dist.concat(pathname));
            } else {

                // Otherwise, route as normal to the public folder
                routeFile(website.folder.concat(pathname));
            }
        }
    }).catch(renderError);

    function renderError(d){
        console.log("Error?",d);
        d = d ? {
            code: 500,
            message: JSON.stringify(d)
        } : {
            code: 500,
            message: "500 Server Error"
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

    /**
     * Given a filename, serve it.
     *
     * Check that the file exists
     * Check the headers..?
     * zip/unzip if needed
     *
     * @param filename
     */
    function routeFile(filename){
        fs.exists(filename, function(exists) {
            if(!exists) {
                console.log("No file found for " + filename);
                response.writeHead(404, {"Content-Type": "text/plain"});
                response.end("404 Page Not Found\n");
                return;
            }

            const acceptedEncoding = request.headers['accept-encoding'] || "";
            const filetype = mime.getType(filename);
            response.setHeader('Content-Type', filetype);

            let router = function(file) {
                response.writeHeader(200);
                response.end(file, "binary");
            };

            fs.stat(filename, function(err, stats){
                // Only zip stuff if it's bigger than 1400 bytes
                if (stats.size > 1400) {
                    if (filetype && (filetype.slice(0,4) === "text" || filetype === "application/json")) {
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

                    if(website.cache) {
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
                }
            });

            fs.readFile(filename, "binary", function(err,file) {
                if(err) {

                    fs.readdir(filename,function(e,d){
                        if(!e && d && d instanceof Array && d.indexOf("index.html") >= 0){
//folder has index.html
//console.log("folder has index");
                            if (filename.lastIndexOf("/") == filename.length - 1) {
                                routeFile(filename+"index.html");
                                return;
                            } else {
                                const url = request.url;
                                let   redirect = url+"/";
                                if (url.indexOf("?") != -1) {
                                    const arr = url.split("?");
                                    redirect = arr[0]+"/?"+arr[1];
                                }
                                response.writeHead(303, {Location: redirect});
                                response.end();
                            }
                        } else if (!e && d && d instanceof Array && d.indexOf("folder.csv") >= 0) {

                            fs.readFile(filename.concat("/folder.csv"), "binary", function(err,file) {
                                const files = [];

                                d.filter(file => file !== "folder.csv")
                                    .filter(file => file[0] !== ".")
                                    .forEach(file => files.push(`<li><a download="${file}" href="${pathname}/${file}">${file}</a></li>`));

                                let result = ``;

                                const parser = parse({
                                    delimiter: ':',
                                    skip_lines_with_error: true,
                                    skip_empty_lines: true,
                                    ltrim: true
                                });

                                parse(file, function(err, d){
                                    if(d.length > 1) {
                                        let links = [];
                                        d.forEach(row => links.push(`<li><a href="${row[1]}">${row[0]}</a></li>`));
                                        links = links.slice(1);

                                        result = result.concat(`
<h1>Links</h1>
<ul>
${links.join("\n")}
</ul>`);
                                    }

                                    result = result.concat(`

<h1>Files</h1>
<ul>
${files.join("\n")}
</ul>`);

                                    response.writeHead(200, {"Content-Type": "text/html"});
                                    response.end(result);
                                });
                            });
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
}


exports.router = router;
//exports.routeFile = routeFile;








