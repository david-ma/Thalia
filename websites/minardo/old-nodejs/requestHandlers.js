var fs = require("fs");
var socket = require("./socket");

function home(response){
	loadTemplate(response, "home");
}

function loadTemplate(response, page, key){
	var initscript = "";
	if(key != "" && key != null){
		initscript = key;//"init('"+key+"')";
	}

	var body = '<!DOCTYPE html>'+
	'<html lang="en">'+
	'<head>'+
	'<title>'+page.charAt(0).toUpperCase() + page.slice(1)+'</title>'+
	'<meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1.0, user-scalable=yes">'+
	'<script type="text/javascript" src="/bower_components/platform/platform.js"></script>'+
	'<script>var initvar="'+initscript+'"</script>'+
	'<link rel="import" href="/js/templates/'+page+'.html">'+
	'</head>'+
	'<body touch-action="auto">'+
	'</body>'+
	'</html>'

	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}

function test(response, page, key){
	var initscript = "";
	if(key != "" && key != null){
		initscript = key;//"init('"+key+"')";
	}

	var body = '<!DOCTYPE html>'+
	'<html lang="en">'+
	'<head>'+
	'<title>'+page.charAt(0).toUpperCase() + page.slice(1)+'</title>'+
	'<meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1.0, user-scalable=yes">'+
	'<script type="text/javascript" src="/bower_components/platform/platform.js"></script>'+
//	'<script>var initvar="'+initscript+'"</script>'+
//	'<link rel="import" href="/pages/'+page+'.html">'+
	'<script type="text/javascript" src="/pages/'+page+'.js"></script>'+
	'</head>'+
	'<body touch-action="auto">'+
	'</body>'+
	'</html>'

	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}


//<meta http-equiv="refresh" content="0; url=http://odonoghuelab.org/"> 

function redditQuestions(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.questions+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditAlbums(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.albums+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditAnything(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.anything+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditHowTo(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.howto+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditRaw(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.raw+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditOldRaw(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.oldraw+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditWebsites(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.websites+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditGear(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.gear+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}
function redditInspiration(response){
	var body ='<meta http-equiv="refresh" content="0; url='+socket.redditlinks.inspiration+'">';
	response.writeHead(200, {"Content-Type": "text/html", "charset": "utf-8"});
	response.write(body);
	response.end();
}

exports.redditQuestions = redditQuestions;
exports.redditAlbums = redditAlbums;
exports.redditAnything = redditAnything;
exports.redditHowTo = redditHowTo;
exports.redditRaw = redditRaw;
exports.redditOldRaw = redditOldRaw;
exports.redditWebsites = redditWebsites;
exports.redditGear = redditGear;
exports.redditInspiration = redditInspiration;

exports.loadTemplate = loadTemplate;
exports.home = home;









































