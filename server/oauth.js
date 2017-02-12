/**
 * David Ma @Frostickle
 * 12 Feb 2017
 *
 * Porting some of my oauth stuff over.
 *
 * Not ready to be used yet!
 */

var request = require('request'); // "Request" library
var querystring = require('querystring');

var oauth = {
	cred: {
		name: 'reddit',
		id: '', // Your client id
		secret: '', // Your client secret
		redirect: 'http://localhost/auth', // Your redirect uri
		scope: "identity",
		url: "https://www.reddit.com/api/v1/authorize?"
	},
	login: function(res, req, db, key) {
		console.log("what is this..?");
		//console.log(this);

		var state = generateRandomString(16),
			cred = this.cred;

		this.state = state;


		console.log(this);

// 		res.cookie(stateKey, state);

		var url = cred.url + querystring.stringify({
				response_type: 'code',
				client_id: cred.id,
				scope: cred.scope,
				redirect_uri: cred.redirect,
				state: state
			});

		res.writeHead(303, {"Content-Type": "text/html"});
		res.end('<meta http-equiv="refresh" content="0; url='+url+'">');

	},
	auth: function(res, req, db, key) {
		var params = querystring.parse(req.url.split("?")[1]);


		console.log(req.headers.cookie);

		if(params.code){

			if(params.state == this.state) {
				console.log("wooowwwww the state matches! "+params.state);
			}


			res.setHeader('Set-Cookie', [this.cred.name+"="+params.code]);






			this.post(res, req, params.code);

// 			res.writeHead(200, {"Content-Type": "text/html"});
// 			res.end('success! '+params.code);
		} else {
			res.writeHead(401, {"Content-Type": "text/html"});
			res.end('No authorisation code');
		}
	},
	post: function(res, req, code){
		console.log("doing a post");

		//let's try to make a request....
		var cookies = parseCookies(req.headers.cookie);

		console.log(cookies);
		if(cookies[this.cred.name]) {

			console.log("hey");

			var stuff = "success! we're logged in, let's make a post!<br><br>"+code;

			var code = code, //cookies[this.cred.name],
				redirect_uri = this.cred.redirect,
				client_id = this.cred.id,
				client_secret = this.cred.secret;


			var authOptions = {
				url: 'https://www.reddit.com/api/v1/access_token',
				form: {
					code: code,
					redirect_uri: redirect_uri,
					grant_type: 'authorization_code'
				},
				headers: {
					'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
				}
			};


			console.log(authOptions);

			request.post(authOptions, function(error, response, body) {
// console.log(response);
				console.log(body);
				if (!error && response.statusCode === 200) {

					body = JSON.parse(body);

					var access_token = body.access_token,
						refresh_token = body.refresh_token;

					var user = "1231035644"
					var playlist = "6fUEtOQ30j5HgA9o5vA6FP"

					var options = {
						url: 'https://api.spotify.com/v1/users/1231035644/playlists/6fUEtOQ30j5HgA9o5vA6FP',
						headers: { 'Authorization': 'Bearer ' + access_token },
						json: true
					};

					// use the access token to access the Spotify Web API
					request.get(options, function(error, response, body) {
//         	console.log("wooo response")
//         	console.log(response)
						console.log("body")
						console.log(JSON.stringify(body));
					});



					res.writeHead(200, {"Content-Type": "text/html"});
					res.end(stuff);





				} else {
					res.writeHead(200, {"Content-Type": "text/html"});
					res.body(error);
					res.end("error");
				}





			});





		} else {
			res.writeHead(401, {"Content-Type": "text/html"});
			res.end("you aren't logged in");
		}



	}
}


var generateRandomString = function(length) {
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};


var parseCookies = function(string){
	var results = {};

	if(string){
		string.split("; ").forEach(function(d){
			var bits = d.split("=");
			results[bits[0]] = bits[1];
		})
	}

	return results;
};



exports.oauth = oauth;
