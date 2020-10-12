import { IncomingMessage, ServerResponse } from "http";

// server.ts
const http  = require("http");
const url   = require("url");
const httpProxy = require('http-proxy');

let blacklist :any = [];
try {
    blacklist = require("../blacklist").blacklist;
    console.log("This is the blacklist:", blacklist);
} catch (e) {}

//This part of the server starts the server on port 80 and logs stuff to the std.out
function start(router :any, handle :any, port :string) {
    let server = null;

    function onRequest(request :IncomingMessage, response :ServerResponse) {
        let spam = false;

        const ip = request.headers['X-Real-IP'] || request.headers['x-real-ip'] || request.connection.remoteAddress;

        if ( ip ) {
            blacklist.forEach(function(thing:any){
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

        function webProxy( config :any ) {
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

            proxyServer.on("error", function(err :any, req :any, res :any ){
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

        function security( passwords :any ){
            let decodedCookiePassword :any = false;

            const cookies :any = {};
            if(request.headers.cookie) {
                request.headers.cookie.split(";").forEach(function(d :any){
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

    console.log("Server has started on port: " + port);
    server = http.createServer(onRequest).listen(port);

    return server.on('upgrade', function(request :any, socket :any, head :any) {
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

function encodeBase64(string :string) {
    "use strict";
    const buff = new Buffer(string);
    return buff.toString('base64');
}

function decodeBase64(data :any) {
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


