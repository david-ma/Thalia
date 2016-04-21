var http = require("http");
var url = require("url");

//This part of the server starts the server on port 80 and logs stuff to the std.out
function start(route, handle) {

	var port = 80; // change the port here?
	var pattern = /^\d{0,5}$/
	var workspace = 'default';

	if(typeof process.argv[2] != null && pattern.exec(process.argv[2])){
		port = process.argv[2];
	} else if(typeof process.argv[3] != null && pattern.exec(process.argv[3])){
		port = process.argv[3];
	}

	// To do: we should check that the workspace exists... otherwise leave it as public
	if (process.argv[2] != null && process.argv[2] != undefined && !pattern.exec(process.argv[2])) {
		workspace = process.argv[2];
	} else if(typeof process.argv[3] != null && process.argv[3] != undefined && !pattern.exec(process.argv[3])){
		workspace = process.argv[3];
	} 

  console.log("Setting workspace to: "+workspace)
  console.log("Server has started on port: " + port);
  handle.index.localhost = workspace;
  handle.addWebsite(require("./"+workspace).site);
  
  return http.createServer(onRequest).listen(port);


	function onRequest(request, response) {

		var pathname = url.parse(request.url).pathname;
		
		console.log();
		console.log("Request for " + pathname);
		console.log("Received at " + getDateTime() +
								" From " + request.connection.remoteAddress);
		route(handle, pathname, response, request);
	}
}

exports.start = start;


function getDateTime() {
//    var date = new Date();
		var date = new Date(Date.now()+36000000);
		//add 10 hours..... such a shitty way to make it australian time....

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

//    var sec  = date.getSeconds();
//    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + " " + hour + ":" + min;// + ":" + sec;
}
