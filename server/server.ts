// server.ts
const https = require("https");
const http  = require("http");
const url   = require("url");
const httpProxy = require('http-proxy');

const blacklist = require("./../blacklist").blacklist || [];
console.log("This is the blacklist:", blacklist);

//This part of the server starts the server on port 80 and logs stuff to the std.out
function start(router, handle, tlsOptions) {
    let server = null;

    function onRequest(request, response) {
        let spam = false;

        const ip = request.headers['X-Real-IP'] || request.headers['x-real-ip'] || request.connection.remoteAddress;

        if ( ip ) {
            blacklist.forEach(function(thing){
                if(ip.includes(thing)) {
                    spam = true;
                    // console.log(`Spam request from ${ip}`);

                    response.writeHead(403);
                    response.end("Go away");
                }
            });
        }

        if (!spam) {
            const host = request.headers.host;
            const proxyConfig = handle.proxies[host];
            const site = handle.getWebsite(host);
            const url_object = url.parse(request.url, true);

            if (host != 'www.monetiseyourwebsite.com') {
                console.log();
                console.log(`Request for ${request.headers.host}${url_object.href} At ${getDateTime()} From ${ip}`);
            }

            if (proxyConfig &&
                (
                    typeof proxyConfig.filter === 'undefined' ||
                    proxyConfig.filter === url.parse(request.url).pathname.split("/")[1]
                )
            ) {
                if(typeof proxyConfig.passwords !== 'undefined' &&
                    Array.isArray(proxyConfig.passwords)
                ) {
                    security( proxyConfig.passwords );
                } else {
                    webProxy( proxyConfig );
                }
            } else {
                router(site, url_object.pathname, response, request);
            }
        }

        function webProxy( config ) {
            const message = config.message || "Error, server is down.";
            const target = `http://${config.host || "127.0.0.1"}:${config.port || 80}`;
            const proxyServer = httpProxy.createProxyServer({
                // preserveHeaderKeyCase: true,
                // autoRewrite: true,
                // followRedirects: true,
                // protocolRewrite: "http",
                // changeOrigin: true,
                target: target
            });

            proxyServer.on("error", function(err, req, res ){
                "use strict";
                console.log(err);
                try {
                    res.writeHead(500);
                    res.end(message);
                } catch (e) {
                    console.log("Error doing proxy!", e);
                }
            });

            proxyServer.web(request, response);
        }

        function security( passwords ){
            let decodedCookiePassword :any = false;

            const cookies :any = {};
            if(request.headers.cookie) {
                request.headers.cookie.split(";").forEach(function(d){
                    cookies[d.split("=")[0].trim()] = d.substring(d.split("=")[0].length+1).trim();
                });

                decodedCookiePassword = decodeBase64(cookies.password);
            }

            const host = request.headers.host;
            const url_object = url.parse(request.url, true);
            const proxyConfig = handle.proxies[host];

            if ( url_object.query.logout ) {
                response.setHeader('Set-Cookie', ["password=;path=/;max-age=1"]);
                response.writeHead(200);
                response.end("Logged out.");
            } else if( url_object.query.password && passwords.indexOf(url_object.query.password) >= 0) {
                let password = encodeBase64(url_object.query.password);
                response.setHeader('Set-Cookie', [`password=${password};path=/;expires=false`]);
                webProxy( proxyConfig );
            } else if ( decodedCookiePassword && passwords.indexOf(decodedCookiePassword) >= 0) {
                webProxy( proxyConfig );
            } else {
                response.writeHead(200);
                response.end(simpleLoginPage);
            }
        }
    }

    let port :string = '1337'; // change the port here?
    const pattern = /^\d{0,5}$/;
    let workspace = 'default';

    if(typeof process.argv[2] !== null && pattern.exec(process.argv[2])){
        port = process.argv[2];
    } else if(typeof process.argv[3] !== null && pattern.exec(process.argv[3])){
        port = process.argv[3];
    }

    // Todo: we should check that the workspace exists, otherwise leave it as default
    if (process.argv[2] !== null && process.argv[2] !== undefined && !pattern.exec(process.argv[2])) {
        workspace = process.argv[2];
    } else if(typeof process.argv[3] !== null && process.argv[3] !== undefined && !pattern.exec(process.argv[3])){
        workspace = process.argv[3];
    }

    console.log("Setting workspace to: "+workspace);
    handle.index.localhost = workspace;

    if (tlsOptions) {
        console.log("Server has started on port: " + 443);
        server = https.createServer(tlsOptions, onRequest).listen(443);
    } else {
        console.log("Server has started on port: " + port);
        server = http.createServer(onRequest).listen(port);
    }

    return server.on('upgrade', function(request, socket, head) {
        "use strict";

        const host = request.headers.host;
        const proxyConfig = handle.proxies[host];

        if(proxyConfig) {
            httpProxy.createProxyServer({
                ws: true,
                target: {
                    host: proxyConfig.host || "127.0.0.1",
                    port: proxyConfig.port || 80
                }
            }).ws(request, socket, head);
        }
    });
}

// exports.start = start;
export { start }

function getDateTime() {
//    var date = new Date();
    var date = new Date(Date.now()+36000000);
    //add 10 hours... such a shitty way to make it australian time...

    var hour :any = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min :any = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var year = date.getFullYear();

    var month :any = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day :any = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + " " + hour + ":" + min;
}

function encodeBase64(string) {
    "use strict";
    const buff = new Buffer(string);
    return buff.toString('base64');
}

function decodeBase64(data) {
    "use strict";
    if(data) {
        const buff = new Buffer(data, 'base64');
        return buff.toString('ascii');
    } else {
        return false;
    }
}

const simpleLoginPage = `<html>
<head>
<title>Login</title>
<style>
div {
    text-align: center;
    width: 300px;
    margin: 200px auto;
    background: lightblue;
    padding: 10px 20px;
    border-radius: 15px;
}
</style>
</head>
<body>
<div>
    <h1>Enter Password</h1>
    <form action="">
        <input type="password" placeholder="Enter Password" name="password" autofocus required>
        <button type="submit">Login</button>
    </form>
</div>
</body>
</html>`;


