var http = require("http");
var url = require("url");

function start(route, handle, designated_port) {
	function onRequest(request, response) {

		var pathname = url.parse(request.url).pathname;
		console.log();
		console.log("Request for " + pathname);
		console.log("Received at " + getDateTime() +
								" From " + request.connection.remoteAddress);
		route(handle, pathname, response, request);
	}
	var port = 80; // change the port here?
	if(typeof designated_port == 'number' && designated_port >= 0) {
		port = designated_port;
	}
  console.log("Server has started on port: " + port);
  return http.createServer(onRequest).listen(port);
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
































