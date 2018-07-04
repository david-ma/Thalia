////////////////////
// INIT GREENLOCK //
////////////////////

const path = require('path');
const os = require('os');
const Greenlock = require('greenlock');
const http = require('http');

const handle = require("./requestHandlers").handle;
handle.loadAllWebsites();

const greenlock = Greenlock.create({
    version: 'draft-11',
    server: 'https://acme-v02.api.letsencrypt.org/directory',

    // approve a growing list of domains
    approveDomains: approveDomains,

    // If you wish to replace the default account and domain key storage plugin
    store: require('le-store-certbot').create({
        configDir: path.join(os.homedir(), 'acme/etc'),
        webrootPath: '/tmp/acme-challenges'
    })
});

////////////////////
// CREATE SERVERS //
////////////////////

const redir = require('redirect-https')();
http.createServer(checkInsecureExceptions).listen(80);

const server = require("./server");
const router = require("./router");

server.start(router.router, handle, greenlock.tlsOptions);

const http01 = require('le-challenge-fs').create({ webrootPath: '/tmp/acme-challenges' });
function approveDomains(opts, certs, cb) {
    console.log("Approving domains...");
    console.log("opts", opts);
    console.log("certs", certs);

    // This is where you check your database and associated
    // email addresses with domains and agreements and such

    // Opt-in to submit stats and get important updates
    opts.communityMember = true;

    // If you wish to replace the default challenge plugin, you may do so here
    opts.challenges = { 'http-01': http01 };

    // The domains being approved for the first time are listed in opts.domains
    // Certs being renewed are listed in certs.altnames
    if (certs) {
        opts.domains = certs.altnames;
    }
    else {
        opts.email = 'greenlock@david-ma.net';
        opts.agreeTos = true;
    }

    // NOTE: you can also change other options such as `challengeType` and `challenge`
    // opts.challengeType = 'http-01';
    // opts.challenge = require('le-challenge-fs').create({});
    cb(null, { options: opts, certs: certs });
}

function checkInsecureExceptions(request, response) {
    "use strict";
    const insecureAllowed = false;

    // todo: allow insecure exceptions

    if( insecureAllowed ) {
        greenlock.middleware(redir)(request, response);
    }
}

function iframePage(link, title) {
    "use strict";
    title = title || "iFrame proxy";
    return `<!DOCTYPE html>
<html lang="en">
<meta charset="UTF-8">
<title>${title}</title>
<body>
<style>
	html, body, iframe {
		margin: 0;
		border: 0;
		width: 100vw;
		height: 100vh;
	}
</style>
<iframe src="${link}">
	<p>Your browser does not support iframes.</p>
</iframe>
</body>
</html>`;
}






