var reddit = {
	links: {
		raw: "https://redd.it/3j7i9m",
		oldraw: "https://redd.it/3i6fta",
		questions: "https://redd.it/3j2xzs",
		albums: "https://redd.it/3j7sdg",
		anything: "https://redd.it/3iubs3",
		howto: "https://redd.it/3ilezg",
		websites: "https://redd.it/3j7t4i",
		gear: "https://redd.it/3gl6p1",
		inspiration: "https://redd.it/3hz2kr",
		follow: "https://redd.it/3gf1x4",
		assignment: "https://redd.it/3n042l"
	},
	redirect: function(res, req, db, type){
		if (typeof(reddit.links[type]) == "string") {
			var query = "select url from reddit_photo_threads where nickname = '"+type+"' order by id desc limit 1;"
			
      if(type === "oldraw") {
        query = "select url from (select id, url from reddit_photo_threads where nickname = 'raw' order by id desc limit 2) as x order by id asc limit 1;"
      }

				db.query(query, function(error, results){	
					if(!error) {
					  if(results && results[0] && results[0].url) {
              var url = results[0].url;

              var body ='<meta http-equiv="refresh" content="0; url='+url+'">';
              res.writeHead(302, {"Location": url});
              res.end(body);
						} else {
              res.writeHead(500);
              res.end("Database Error");
						}
					} else {
						res.writeHead(500);
						res.end("Database Error");
					}
				});

		} else {
			console.log("error, 400 no service found");

			res.writeHead(400, {"Content-Type": "text/plain"});
			res.end("400 Bad Request\n");
			return;
		}
	}
};



exports.config = {
	domains: ["david-ma.net"],
	pages: {
		"": "/index.html",
		"resume": "/resume.pdf",
		"hackers": "/hackers.txt",
		"instameet": "/example.jpg",
		"talks": "/talks.html"
	},
	redirects: {
		"/github": "https://github.com/david-ma/",
		"/wwim12_syd": "https://www.facebook.com/groups/741261649334543/",
		"/publications": "https://scholar.google.com.au/citations?user=i3b7M5MAAAAJ",
		"/dropbox": "https://www.dropbox.com/campuscup?referrer=MjE4MzE3MTc1",
		"/hh": "https://www.dropbox.com/sh/0bmjwnbvc7wqncq/AADmRUEshbSczd2lVnEAw64-a?dl=0",
		"/IgersSydneyCNY": "https://www.google.com/maps/d/edit?mid=z8RslIl-wN2Q.kiOR82oeewsI&usp=sharing",
		"/talks/VIZBI2016": "https://docs.google.com/presentation/d/132qHk5B1MGEsP_cuG8CAzBCK2-zYmUxM4w-hNYxl8DE/pub?start=false&loop=false&delayms=3000",
		"/talks/vizbi2016": "https://docs.google.com/presentation/d/132qHk5B1MGEsP_cuG8CAzBCK2-zYmUxM4w-hNYxl8DE/pub?start=false&loop=false&delayms=3000",
		"/talks/photography": "https://docs.google.com/presentation/d/1aUh5oIvFQBE4YxiagKByr2dycIl-ZKH9wAo0KkdolaM/pub?start=false&loop=false&delayms=3000",
		"/ifttt": "https://ifttt.com/recipes/284348-real-instagram-photos-in-twitter",
		"/pathos": "http://10.126.67.70:8080/PathOS/",
		"/govhack": "https://docs.google.com/presentation/d/1dvGaKXLaBzGVOToTjfGFxdfij5rXMFfxepPgO2aEFvY/pub?start=false&loop=false&delayms=3000",
		"/hackaus": "https://www.facebook.com/groups/hackathonsaustralia/",
		"/okfnau": "http://www.meetup.com/en-AU/Open-Knowledge-Melbourne/"
	},
	services: {
		"reddit": reddit.redirect
	}
};

















