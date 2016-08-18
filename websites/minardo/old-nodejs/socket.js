var last_time = 0;
var m0_data = {};
var last_checked = {};
var scrapbook = {};
var fs = require("fs");
var gs = require("./spreadsheets");
var time = require("time");
var csv = require("csv");
var request = require("request");

var wait_time = 900000; //15 minutes in milliseconds
var public_tags = {
			"reddit": "http://www.reddit.com/u/frostickle",
			"tumblr": "http://frostickle.tumblr.com",
			"last.fm": "http://www.last.fm/user/Nicotinamide",
			"facebook": "http://facebook.com/frostickle/",
			"twitter": "https://twitter.com/frostickle",
			"instagram": "http://instagram.com/frostickle",
			"flickr": "https://www.flickr.com/photos/frostickle/",
			"spotify": "http://open.spotify.com/user/1231035644",
			"email": "mailto:mail@david-ma.net"
  };
var private_tags = {
}
var email = "minardoapp@gmail.com",
		password = "^H*rVb97T3@Xak%rF9kv";
var browsers = {},
		ip = {},
		queries = {};

function init(io){
//load data from hard drive
	fs.readFile(__dirname+'/scrapbook.data', {'encoding':'utf8'}, function(err, d){
		if(!err){
			console.log("scrapbook loaded!");
			scrapbook = JSON.parse(d);
		} else {
			console.log(err);
		}
	});
	fs.readFile(__dirname+'/minard0.data', {'encoding':'utf8'}, function(err, d){
		if(!err){
			m0_data = JSON.parse(d);
		} else {
			console.log(err);
		}
	});
	refresh_config();
	redditlinks.refresh();

	io.on('connection', function(socket){
	console.log("socket connected at "+socket.id+" "+socket.request.connection.remoteAddress+" "+socket.handshake.headers.referer);


//always emit these things:
  // These tags will autocomplete
  socket.emit("availableTags", public_tags);
  // These tags will be hidden
  socket.emit("hiddenTags", private_tags);

  socket.emit("config",{
  	milliseconds_label: wait_time
  })
  socket.on("cache_milliseconds", function(d){
  	if(parseInt(d.milliseconds_label) >= 0){
  		wait_time = parseInt(d.milliseconds_label);
  	}
  });

  socket.on("refresh_config", refresh_config);
  
	socket.on("makeNewSpreadsheet", function(d){
		console.log("making a new spreadsheet");
		console.log(d);
		var doc = new gs.newSpreadsheet();


		doc.setAuth(email, password, function(err){
			if(!err){
				doc.newSheet(function(err,d,j){
					console.log("newSheet callback:");
					console.log(err);
					console.log(d);
					console.log(j);
				});
			}
		});
	});








//post quiz results to google docs
	socket.on("quiz", function(d){

		if(d.key && d.answers){
			var doc = new gs.init(d.key);
			d.answers.time = new Date();
			d.answers.ip = socket.request.connection.remoteAddress;
			d.answers.referer = socket.handshake.headers.referer;

			doc.setAuth(email, password, function(err){
				doc.addRow(2, d.answers,function(err,d){
//					console.log("adding row");
//					console.log(err);
//					console.log(d);
					socket.emit("quiz_success",d);
				});
			});
		}
	});




// david-ma.net homepage searchbox query handling looks like this:
  socket.on('query', function(d){
  	var query = d['query'].trim().toLowerCase();

// console.log(socket.conn);
  	tally(browsers, socket.conn.request.headers['user-agent']);
  	tally(queries, query);
//  	tally(ip, request.connection.remoteAddress);

		if(query == 'logs'){
			console.log(queries);
//			console.log(ip);
			console.log(browsers);
		}

		//album stuff
  	fs.readdir(__dirname+'/../public/albums/', function(err, albums){
  		if(!err){
				response = {'albums': albums};
				listOfAlbums = albums;

				if (albums.indexOf(query) != -1){
					fs.readdir(__dirname+'/../public/albums/'+query, function(err, photos){
						if(!err){
							response['album'] = photos;
							response['albumname'] = query;
							
							//album found
							socket.emit('searchReturn',response); 
						}
					});
				} else {

					if(private_tags[query] != null){
						response.url = private_tags[query];
					}

					//album not found
					socket.emit('searchReturn', response);
				}
			}
  	});
  	
  });

		
		// m0_load = minardo wants to load something
		socket.on("m0_load", function(d){
			if(d){
				if(d.key){
					socket.emit("m0_data", m0_data[d.key]);
					load_data(d.key);
				}
			}
		});

		// generic_load = load any google doc, and pass it back
		socket.on("generic_load", function(d){
			if(d){
				if(d.key){
					if(typeof scrapbook[d.key] == 'undefined'){
						console.log("oh no, first load, stall for time!");
						socket.emit("loading", {"thing":"Stall for time!"});
						generic_load(d.key, socket);
	//					socket.emit("generic_data", scrapbook[d.key])
					} else {
						socket.emit("generic_data", scrapbook[d.key]);
						generic_load(d.key);
					}
				}
			}
		});
	});
}

var redditlinks = {
	questions: "http://redd.it/2dn000",
	albums: "http://redd.it/2cun41",
	anything: "http://redd.it/2d60zq",
	howto: "http://redd.it/2cun04",
	websites: "http://redd.it/2i5zzx",
	raw: "http://redd.it/2jop1k",
	oldraw: "http://redd.it/2j0rvh",
	gear: "http://redd.it/2j7kfn",
	inspiration: "http://redd.it/2hvr8u",
	refresh: function(){
console.log("refreshing reddit links!")

		request.get({url:"https://docs.google.com/spreadsheets/d/1gqwHe4VJXED_0NQG5L6FyHbQMWlRKJkxHQp4khGBYlc/pub?gid=0&single=true&output=csv"}, function(e,r,body){

	if (!e) {
		csv.parse(body, function(e, d){
			if (!e) {

for(var i = 1; i < d.length; i++){
	if(d[i][1] == "Official Question Thread! Ask /r/photography anything you want to know about photography or cameras! Don't be shy! Newbies welcome!"){
		redditlinks.questions = d[i][2];
	} else if(d[i][1] == "Official Album Thread! Post an album from your photos, let reddit pick the best one out of the album!"){
		redditlinks.albums = d[i][2];
	} else if(d[i][1] == "Official Anything Goes Thread! Weekend Photo Community Thread &lt;3"){
		redditlinks.anything = d[i][2];
	} else if(d[i][1] == 'Official Weekly "How was this photo taken?" Thread!'){
		redditlinks.howto = d[i][2];
	} else if(d[i][1] == 'Official weekly RAW editing challenge!'){
		redditlinks.oldraw = redditlinks.raw;
		redditlinks.raw = d[i][2];
	} else if(d[i][1] == 'Official Monthly Website/Portfolio Thread!'){
		redditlinks.websites = d[i][2];
	} else if(d[i][1] == 'Official Monthly Gearporn Thread!'){
		redditlinks.gear = d[i][2];
	} else if(d[i][1] == 'Official Monthly Inspiration Thread!'){
		redditlinks.inspiration = d[i][2];
	} else {
		console.log("error");
		console.log(d[i][1]);
	}
}


			}
		});
	}
});



	},
	oldrefresh: function(){
		console.log("Refreshing reddit links");
		
		var doc = new gs.init("1gqwHe4VJXED_0NQG5L6FyHbQMWlRKJkxHQp4khGBYlc");
//		var doc = new gs.init("153jjcQeBDM2pk1yX3pD3flVGuAA6H95ZppC0D4OZSUk");
//		var doc = new gs.init("195we3xf_0t_CvIDR9o48YXuQyzVIhIZZJ9-E-D9Dt8E");

		doc.setAuth(email, password, function(err){
			doc.getInfo( function( err, info ){
				if(!err) {
					var threads = info.worksheets[0];
					threads.getRows(0, {'start-index':1,'max-results':threads.rowCount}, function(err, d){
						if(!err){
							d.forEach(function(row){
								if(row.title == "Official Question Thread! Ask /r/photography anything you want to know about photography or cameras! Don't be shy! Newbies welcome!"){
									redditlinks.questions = row.url;
								} else if(row.title == "Official Album Thread! Post an album from your photos, let reddit pick the best one out of the album!"){
									redditlinks.albums = row.url;
								} else if(row.title == "Official Anything Goes Thread! Weekend Photo Community Thread &lt;3"){
									redditlinks.anything = row.url;
								} else if(row.title == 'Official Weekly "How was this photo taken?" Thread!'){
									redditlinks.howto = row.url;
								} else if(row.title == 'Official weekly RAW editing challenge!'){
									redditlinks.oldraw = redditlinks.raw;
									redditlinks.raw = row.url;
								} else if(row.title == 'Official Monthly Website/Portfolio Thread!'){
									redditlinks.websites = row.url;
								} else if(row.title == 'Official Monthly Gearporn Thread!'){
									redditlinks.gear = row.url;
								} else if(row.title == 'Official Monthly Inspiration Thread!'){
									redditlinks.inspiration = row.url;
								} else {
									console.log("error");
									console.log(row.title);
								}
							});
						}
					});
				} else {
					console.log(err);
				}
			});
		});
	}
}


var cronJob = require('cron').CronJob;
var job = new cronJob('00 21 01 * * 0-6', function(){
    // Runs every day at 1 AM.
    redditlinks.refresh();
  }, function () {
    // This function is executed when the job stops
  },
  true, /* Start the job right now */
  timeZone = "Australia/Sydney"
);


//helper tally function
function tally(object, thing) {
	if(typeof object[thing] == 'undefined'){
		object[thing] = 1;
	} else {
		object[thing]++;
	}
}

//helper function for minardo load
function load_data(key){
	if(new Date().getTime() - last_time > wait_time) {
		last_time = new Date().getTime();
		var pathway = {};
		var kinases = {};
		var substrates = {};
		var metadata = {};
		var timeseries = {};
		var timepoints = [];
		var ready = {
			"pathway": false,
			"kinases": false,
			"substrates": false,
			"metadata": false,
			"timeseries": false
		}

		var doc = new gs.init(key);
		doc.setAuth(email, password, function(err){
			doc.getInfo( function( err, info ){
				if(!err) {
					console.log("Starting to load "+info.title+'...' );
					sP = info.worksheets[0];
					sK = info.worksheets[1];
					sS = info.worksheets[2];
					sM = info.worksheets[3];
					sT = info.worksheets[4];

					sP.getRows(0,{'start-index':1,'max-results':sP.rowCount},function(err,d){
						if(!err){
							d.forEach(function(data){
								pathway[data.id] = {
									"name": data.name,
									"comment": data.comment,
									"PMID": data.PMID,
									"feature": data.feature,
									"activity": data.activity
								}
							});
							ready.pathway = true;
							callback();
						}
					});
		
					sK.getRows(0,{'start-index':1,'max-results':sK.rowCount},function(err,d){
						if(!err){
							d.forEach(function(data){
								if (kinases[data.group]) {
									kinases[data.group].push(data.phosphosites);
								} else {
									kinases[data.group] = [data.phosphosites];
								}
							});
							ready.kinases = true;
							callback();
						}
					});

					sS.getRows(0,{'start-index':1,'max-results':sS.rowCount},function(err,d){
						if(!err){
							d.forEach(function(data){
								if (substrates[data.group]) {
									substrates[data.group].push(data.substrates);
								} else {
									substrates[data.group] = [data.substrates];
								}
							});
							ready.substrates = true;
							callback();
						}
					});
		
					sM.getRows(0,{'start-index':1,'max-results':sM.rowCount},function(err,d){
						if(!err){
							d.forEach(function(data){
								metadata[data.id] = {
									"aa": data.aa,
									"pos": data.pos,
									"ipi": data.ipi,
									"uniprot": data.uniprot
								}
							});
							ready.metadata = true;
							callback();
						}
					});

					sT.getRows(0,{'start-index':1,'max-results':sT.rowCount},function(err,d){
						if(!err){
							if(typeof d[0] != 'undefined'){
								var keys = Object.keys(d[0]);
								keys.forEach(function(key){
									if (key != '_xml' &&
											key != 'id' &&
											key != 'title' &&
											key != 'content' &&
											key != '_links' &&
											key != 'save' &&
											key != 'del'){
										timepoints.push(key);
									}
								});
							}
							d.forEach(function(data){
								timeseries[data.id] = [];
								timepoints.forEach(function(timepoint){
									timeseries[data.id].push(data[timepoint]);
								});
							});
							ready.timeseries = true;
							callback();
						}
					});

				} else {
					console.log("There was an error loading the google doc... "+key);
					console.log(err);
					console.trace();
				}
			});
		});

		function callback(){
			if (ready.pathway &&
					ready.kinases &&
					ready.substrates &&
					ready.metadata &&
					ready.timeseries){
				console.log("...finished loading "+key);
				var meta = {},
						time = {},
						sub = {},
						kin = {};
				Object.keys(pathway).forEach(function(id){
					meta[id] = metadata[id];
					time[id] = timeseries[id];
					if(substrate(id)){
						if (typeof sub[substrate(id)] == 'undefined'){
							sub[substrate(id)] = [id];
						} else {
							sub[substrate(id)].push(id);
						}
					}
					if(kinase(id)){
						if (typeof kin[kinase(id)] == 'undefined'){
							kin[kinase(id)] = [id];
						} else {
							kin[kinase(id)].push(id);
						}
					}
				});
				m0_data[key] = {
					"pathway": pathway,
					"kinases": kin,
					"substrates": sub,
					"metadata": meta,
					"timeseries": time,
					"timepoints": timepoints
				}
				fs.writeFile(__dirname+'/minard0.data', JSON.stringify(m0_data));
				function substrate(id){
					var val = false;
					Object.keys(substrates).forEach(function(group){
						substrates[group].forEach(function(site){
							if (site == id){
								val = group;
							}
						});
					});
					return val;
				}
				function kinase(id){
					var val = false;
					Object.keys(kinases).forEach(function(group){
						kinases[group].forEach(function(site){
							if (site == id){
								val = group;
							}
						});
					});
					return val;
				}
			}
		}
	}
}

//helper funciton for generic load
function generic_load(key, socket){
	var doc = new gs.init(key);
	var numberOfSheets = 0;
	var ready = 0;
	var current_time = new Date().getTime();
	console.log("calling generic load on"+key);
	if(typeof last_checked[key] == 'undefined' ||
						last_checked[key] + wait_time < current_time) {
		last_checked[key] = current_time;
		doc.setAuth(email, password, function(err){
			if(!err){ //we have a document...
				doc.getInfo( function( err, info ){
					if(!err) {
						console.log('Starting to load "'+info.title+'"...' );
						numberOfSheets = info.worksheets.length;
						var document = {
							title: info.title,
							updated: info.updated,
							author: info.author
						};
						a();
						function a(){
							info.worksheets.forEach(function(worksheet, i){
								worksheet.getCells({
									minRow: 1,
									maxRow: worksheet.rowCount,
									minCol: 1,
									maxCol: worksheet.colCount
								},function(err,dat){
									if(dat)
									dat.forEach(function(d, i){
										if(!document[worksheet.title]){
											document[worksheet.title] = [];
										}
										if(!document[worksheet.title][d.row]){
											document[worksheet.title][d.row] = [];
										}
										document[worksheet.title][d.row][d.col] = d.value;
										if(i == dat.length-1){
											ready++;
											callback(document);
										}
									});
								});
							});
						}
					} else {
						console.log("There was an error loading the google doc... "+key);
						console.log(err);
						console.trace();
					}
				});
			} else {
				console.log("There was an error authenticating... "+key);
				console.log(err);
				console.trace();
			}
		});
	} else {
		console.log("data is still fresh, not reloading");
	}
	
	return null;

	function callback(document){
		if(ready == numberOfSheets){
			console.log("...finished loading "+key);
			scrapbook[key] = document;
			if(typeof socket!= 'undefined'){
				socket.emit("generic_data", scrapbook[key]);
			}
//			console.log(Object.keys(scrapbook["11w61At2RjK31zbnpNllSwiB9czlh3d_jQV8inN6j4sU"]));
			fs.writeFile(__dirname+'/scrapbook.data', JSON.stringify(scrapbook),function (err) {
				if (err) {
					console.log("error!")
				} else {
					console.log("wrote to scrapbook!");
				}
			});
		}
	}
}

function refresh_config(d){
	console.log("refreshing config");

	var doc = new gs.init("1qe-k01Gglsdm2bEuNLmz-qmfZac7iPjo1rTosxWTYnA");
	doc.setAuth(email, password, function(err){
		doc.getInfo( function( err, info ){
			if(!err) {
// 					console.log("refreshing query tags");
				var queries = info.worksheets[0];
				queries.getRows(0, {'start-index':1,'max-results':queries.rowCount}, function(err, d){
					if(!err){
						public_tags = {};
						private_tags = {};
						d.forEach(function(row){
// 								console.log(row.query)
							if(row.public == "yes"){
								public_tags[row.query] = row.url;
							} else {
								private_tags[row.query] = row.url;
							}
						});
					}
				});
			}
		});
	});
};

exports.init = init;
exports.redditlinks = redditlinks;










