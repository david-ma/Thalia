var http = require("http");
var url = require("url");

//This part of the server starts the server on port 80 and logs stuff to the std.out
function start(route, handle) {

    function onRequest(request, response) {

        if (handle.proxies[request.headers.host]) {
            proxy(request, response, handle.proxies[request.headers.host]);
        } else {
            var site = handle.getWebsite(request.headers.host);

            var url_object = url.parse(request.url);

            console.log();
            console.log("Request for "+ request.headers.host + url_object.href + " At " + getDateTime() +
                " From " + request.connection.remoteAddress);

            route(site, url_object.pathname, response, request);
        }
    }

	var port = 1337; // change the port here?
	var pattern = /^\d{0,5}$/;
	var workspace = 'default';

	if(typeof process.argv[2] !== null && pattern.exec(process.argv[2])){
		port = process.argv[2];
	} else if(typeof process.argv[3] !== null && pattern.exec(process.argv[3])){
		port = process.argv[3];
	}

	// To do: we should check that the workspace exists, otherwise leave it as default
	if (process.argv[2] !== null && process.argv[2] !== undefined && !pattern.exec(process.argv[2])) {
		workspace = process.argv[2];
	} else if(typeof process.argv[3] !== null && process.argv[3] !== undefined && !pattern.exec(process.argv[3])){
		workspace = process.argv[3];
	} 

  console.log("Setting workspace to: "+workspace);
  console.log("Server has started on port: " + port);
  handle.index.localhost = workspace;
  return http.createServer(onRequest).listen(port);
}

exports.start = start;

function proxy(client_req, client_res, proxy) {
  console.log('Proxying to: ' + proxy.host + ':' + proxy.port + client_req.url);
    var message = proxy.message || "Error, server is down.";

  var options = {
    host: proxy.host,
    port: proxy.port,
    path: client_req.url,
    method: client_req.method,
    headers: client_req.headers
  };

  var proxyServer = http.request(options, function (res) {
      client_res.writeHeader(res.statusCode, res.headers);
      res.pipe(client_res, {
        end: true
      });
  });

  proxyServer.on('error', function(err){
    console.log(err);
    client_res.write(message);
    client_res.end();
  });

  client_req.pipe(proxyServer, {
    end: true
  });
}

function getDateTime() {
//    var date = new Date();
		var date = new Date(Date.now()+36000000);
		//add 10 hours... such a shitty way to make it australian time...

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + " " + hour + ":" + min;
}
