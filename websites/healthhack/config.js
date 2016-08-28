const fs = require('fs');
const formidable = require('formidable');
const path = require('path');
const util = require('util');

var sites = {
	"sydney": true,
	"melbourne": true,
	"canberra": true,
	"brisbane": true,
	"perth": true
};

exports.config = {
	domains: ["healthhack.david-ma.net", "healthhack.com.au", "www.healthhack.com.au", "test.healthhack.com.au", "2016.healthhack.com.au"],
	pages: {
		"melbourne": "/site.html",
		"sydney": "/site.html",
		"canberra": "/site.html",
		"brisbane": "/site.html",
		"perth": "/site.html",
		"edit-melbourne": "/edit-site.html",
		"edit-sydney": "/edit-site.html",
		"edit-canberra": "/edit-site.html",
		"edit-brisbane": "/edit-site.html",
		"edit-perth": "/edit-site.html"
	},


	services: {
		"edit_site": function(res, req, db, type){
			console.log("Ok, Editing Site...");

			// create an incoming form object
			var form = new formidable.IncomingForm();

			// specify that we want to allow the user to upload multiple files in a single request
			form.multiples = true;

			// store all uploads in the /uploads directory
			form.uploadDir = path.join(__dirname, '/tmp');

			// log any errors that occur
			form.on('error', function(err) {
				console.log('An error has occured: \n' + err);
			});

			// parse the incoming request containing the form data
			form.parse(req, function(err, fields, files) {

				// Protected by a password... change your password here
				// We should also probably rate limit this shit
				if(fields.password === "whiterabbit") {

					var images = {
						venue_logo: fields.venue_logo,
						venue_image: fields.venue_image,
						site_photo: fields.site_photo
					};

					Object.keys(files).forEach(function(key){
						if(files[key].name) {
							images[key] = '/images/uploads/'+fields.site.toLowerCase()+'/'+files[key].name;
							fs.createReadStream(files[key].path).pipe(fs.createWriteStream(path.join(__dirname, '/public'+images[key])));
							fs.rename(files[key].path, path.join(form.uploadDir, files[key].name));
						}
					});

					var query = "INSERT INTO `healthhack_sites` (`id`, `site`, `venue`, `address`, `lat`, `lng`, `placeId`, `venue_logo`, `venue_image`, `venue_description`, `site_info_title`, `site_photo`, `site_description`) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";

					db.queryVariables(query, [fields.site, fields.venue, fields.address, fields.lat, fields.lng, fields.placeId, images.venue_logo, images.venue_image, fields.venue_description, fields.site_info_title, images.site_photo, fields.site_description], function(err, results) {
						if(!err) {
							if (fields.password === "debug") {
								res.writeHead(200, {'content-type': 'text/plain'});
								res.write('Success!\n');
								res.write('Received upload:\n\n');
								res.write(util.inspect({fields: fields, files: files}));
								res.write('\n\nDatabase results:\n');
								res.write(JSON.stringify(results));
								res.end();
							} else {
								console.log(fields);
								var url = fields.current_url;
								var body ='<meta http-equiv="refresh" content="0; url='+url+'">';
								res.writeHead(302, {"Location": url});
								res.end(body);
							}
						} else {
							res.writeHead(500, {'content-type': 'text/plain'});
							res.end(JSON.stringify(err));
						}
					});
				} else {
					res.writeHead(403, {'content-type': 'text/plain'});
					res.end("Wrong Password");
				}
			});

		},
		"upload_sponsor": function(res, req, db, type){
			console.log("Woo! Uploading sponsor...");

			// create an incoming form object
			var form = new formidable.IncomingForm();

			// specify that we want to allow the user to upload multiple files in a single request
			form.multiples = true;

			// store all uploads in the /uploads directory
			form.uploadDir = path.join(__dirname, '/tmp');

			// log any errors that occur
			form.on('error', function(err) {
				console.log('An error has occured: \n' + err);
			});

			// parse the incoming request containing the form data
			form.parse(req, function(err, fields, files) {

                // Protected by a password... change your password here
                // We should also probably rate limit this shit
				if(fields.password === "whiterabbit") {
					var logo_src = fields.logo,
						auth = fields.auth === "confirmed" ? 1 : 0;

					if(files.logo && files.logo.name !== "") {
						logo_src = '/images/uploads/'+files.logo.name;
						fs.createReadStream(files.logo.path).pipe(fs.createWriteStream(path.join(__dirname, '/public'+logo_src)));
						fs.rename(files.logo.path, path.join(form.uploadDir, files.logo.name));
					}

					var query = "INSERT INTO `healthhack_sponsors` (`id`, `name`, `logo`, `link`, `text`, `site`, `auth`) VALUES (NULL, ?, ?, ?, ?, ?, ?);";

					db.queryVariables(query, [fields.name, logo_src, fields.link, fields.text, fields.site, auth], function(err, results) {
						if(!err) {
							if (fields.password === "debug") {
								res.writeHead(200, {'content-type': 'text/plain'});
								res.write('Success!\n');
								res.write('Received upload:\n\n');
								res.write(util.inspect({fields: fields, files: files}));
								res.write('\n\nDatabase results:\n');
								res.write(JSON.stringify(results));
								res.end();
							} else {
								console.log(fields);
								var url = fields.current_url;
								var body ='<meta http-equiv="refresh" content="0; url='+url+'">';
								res.writeHead(302, {"Location": url});
								res.end(body);
							}
						} else {
							res.writeHead(500, {'content-type': 'text/plain'});
							res.end(JSON.stringify(err));
						}
					});
				} else {
					res.writeHead(403, {'content-type': 'text/plain'});
					res.end("Wrong Password");
				}
			});

		},
		"site": function(res, req, db, type){
			if(sites.hasOwnProperty(type.toLowerCase())) {
				var query = "select * from `healthhack_sites` where site='"+type+"' ORDER BY 1 DESC limit 1;";
				db.query(query, function(error, results){
					if(!error){
						res.writeHead(200);
						res.end(JSON.stringify(results));
					} else {
						res.writeHead(500);
						res.end(JSON.stringify(error));
					}
				});
			} else {
				res.writeHead(500);
				res.end("Error");
			}
		},
		"sponsors": function(res, req, db, type){
			if(sites.hasOwnProperty(type.toLowerCase())) {
				// var query = "select * from `healthhack_sponsors` where site = 'national' or site = '"+type+"';";
				var query = "select max.id, max.name, logo, link, text, site, auth from (select MAX(id) as id, name from `healthhack_sponsors` where site='national' or site='"+type+"' group by name) as max, `healthhack_sponsors` where `healthhack_sponsors`.id = max.id;";
				db.query(query, function(error, results){
					if(!error){
						res.writeHead(200);
						res.end(JSON.stringify(results));
					} else {
						res.writeHead(500);
						res.end(JSON.stringify(error));
					}
				});
			} else {
				res.writeHead(500);
				res.end("Error");
			}
		}
	},
	sockets: {
		emit: [],
		on: [{"name": "healthhack_email",
			"callback": function(d, database){
				console.log("someone sent us some email info...");
				var socket = this;

				// We should probably catch some errors... meh

				var query = "INSERT INTO `healthhack_mail` (`name`, `email`, `role`, `message`) VALUES (?, ?, ?, ?)";

				database.queryVariables(query, [d.name, d.email, d.role, d.message], function(err, results) {

					console.log(err);
					console.log(results);
					if(err){
						console.log(err);
					} else {
						console.log(results);
						console.log("success!");
					}
				});

			}
		}]
	}
};
