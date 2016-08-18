var cred = require("./credentials").cred;
var db = require("./database").db;


var Twitter = require('twitter');
 
var client = new Twitter(cred.twitter);
 
 
 
// Get list of names (from database?)
// Open a connection to twitter
// start querying every name
// push back to database?


// do a twitter query






var twit = {
	init: function(cb){


		console.log("intitialising twitter stuff!");

		var params = {screen_name: 'nodejs'};
		client.get('statuses/user_timeline', params, function(error, tweets, response){
			if (!error) {
				cb(tweets);
			}
		});


	},
	arbitrary: function(d, cb){
		console.log("running arbitrary twitter thing...");
		
		if(d && d.call && d.params) {
			client.get(d.call, d.params, function(error, tweets, response){
				if (!error) {
					if(tweets.length > 0) {
						console.log(d.params.q + " is " + tweets[0].screen_name);
					} else {
						console.log(d.params.q + " not found");
					}
					cb(tweets);
				}
			});
		}

	},
	arbitrary_to_database: function(d, cb){
		console.log("running arbitrary twitter thing with DB support");
		
		if(d && d.call && d.params) {
			client.get(d.call, d.params, function(error, tweets, response){
				if (!error) {
					if(tweets.length > 0) {
						console.log(d.params.q + " is " + tweets[0].screen_name);
						db.insert_twitter_name({
							username: tweets[0].screen_name,
							sourcename: d.params.q,
							description: tweets[0].description
						}, function(d){
							console.log(d);
						})
						console.log("wooooo");


					} else {
						console.log(d.params.q + " not found");
					}
					cb(tweets);
				}
			});
		}
	},
	oneoff: function(){
		var names = [
"Lily Partland","Lionel Bonaventure","Lionie Higgins Noone","Lisa Andersen","Lisa Clarke","Lisa Kingsberry","Lisa Sampson","Lisa Tomasetti","Lish Fejer","Liuncoln Dalla Santa","Liz Hedge","Liz Keen","Liz Shoecraft","Liz Sinclair","Lliz Hedge","Lloyd Cofield","Longreach Leader","Lord Howe Islander","Lori Black","Lorrain Horsley","Lorraine Horsley","Lorraine Kath","Lost Townsville","Lou Glover","Louise Maher","Louise Potterton","Louise Randell","Louise Ray","Lucia Hill","Lucinda Kent","Lucy Carter","Luke Griffin","Luke Skerman","Luke Wong","Lyn Battle","Lyn Oxley","lynamPics","M. Watson","M12","Mac Chandler","Maddie Whitford","MAJ Peter Thomas","Marc Eiden","Marcoola Surf Club","Marcus Thompson","Mardi Green","Maree Yoelu","Mareeba Heritage Museum","Margaret","Margaret Bertling","Margaret Burin","Margaret Sirl","Margarette Sinnamon","Margot Bennet","margs1913","Mari Ekkje","Marian Drew","Marie Bright","Marieke Hardy","Marilyn","Mario Faggion","Mark Dadswell","Mark Debono","Mark Gallagher","Mark Kelly","Mark McFadgery","Mark Nielsen","Mark Nolan","Mark Vear","Martin Bleby","Martin Davies","Marty McCarthy","Marvi Lacar","Marvin Muller","Mary Bonet","MaryBeth Gundrum","Matt Biocich","Matt Dowling","Matt Herring","Matt Macklin","Matt Parker","Matt Shepherd","Matthew Bevan","Matthew Daley","Matthew Duncan","Matthew Hickey","Matthew Lambert","Matthew Perkins","Matthew Smith","mattyp","Maureen Clark","Max Carson","Max Charping","Max Dupain","Max Tanks","Maynard","McKinlay Shire Council","Meg Rice","Megan McGuinness","Meghan Woods","Melanie Pearce","Melanie Sim","Melissa Maddison","Melissa Wynn","Merrett","Merri Della Santa","Mery Weetra","Meryl Weetra","Michael Bromage","Michael Charlton","Michael Heiman","Michael Jacobson","Michael Jefferies","Michael Lees","Michael Leunig","Michael Merrington","Michael Noad","Michael Packer","Michael Rayment","Michael Rennie","Michael Spooner","Michael Woodward","Michelle Baumgartner","Michelle Campbell","Michelle Maartensz","Mick Streek","Migration Museum","Mike Chuk","Mikki Trail","Mildura International Balloon Fiesta","Millington","Mimili Maku Arts","Miranda Grant","Miranda Tetlow","miss.libertine","MODIS Satellite","MoMA","Monica Gyoery","Monique Bowley","Morne de Klerk","Mrs Jackie Cornish","Mt Hotham Alpine Resort Management Board","N Fernbach","Nadine Maloney","Nancy Murphy","Narelle Graham","Narelle Wells","Natalie Burke","Natalie Grono","Natalie Ord","Natalija Brunovs","Nathalie Fernbach","Nathan Morris","National Archives","National Archives of Australia","Neale Winter","Neda Vanovac","Neil Helmore","Neil McCumber","Neil Raaschou","Neville Walsh","Newcastle City Council draft masterplan","Newcastle Maritime Centre","Newcastle Morning Herald","Newcastle Morning Herald 1950","NGA","Nic MacBean","Nic Montagu","Nichole Sobecki","Nick Balmer","Nick Fogarty","Nick Gerber","Nick Monk","Nick Potter","Nicola Meffon on Carbon","Nicole Bond","Nicole Foote","Nicole Lee","Nicole Radcliffe","nicshields","Nigel K Daw","Nigel Paul","Niki Lyons","Nikki Jensen","Nikos Koutoulas","Noah Schultz-Byard","Noah Schutlz-Byard","Normandale","NRL","NSW National Parks and Wildlife","NSW SES","Olive Codling","Olivia Bernadini","Olivia Devine","Open Gardens Australia","Our Lady of the River yr 5-6","Owen Power","Paap","Pam","Paolo Busato","paperrockjen","Parks Victoria","Pat Forster","Patrick Nelson","Paul Arnold","Paul Hackett","Paul Jones","Paul Jurak","Paul McFarlane","Paul Stumkat","Paul Thomsen","Paul Turton","Paul Wutzke","Paulette McIntosh","Penleigh Boyd","Penny Dahl","Penny Dews","Penny Marshall","Penny Mclintock","Penny Terry","Penny Timms","Peta Khan","Peta Martin","Peta-Marie Standley","Peter","Peter Auer","Peter Bower","Peter Carroll","Peter Creith","Peter Eastway","Peter Elfes","Peter Giafis","Peter Gibbs","Peter Gunders","Peter Harrison","Peter Hayward (Ngarkat)","Peter Horne","Peter Kervarec","Peter Little","Peter Lonergan","Peter Riley","Peter Scott","Peter Smeeth","Peter Smith","Peter Trayhurn","Peter Whiting","Phil Ashley-Brown","Phil Smith","Phil Staley","Phil Thompson","philandchris","Philip Samartzis","Phoebe Moore and Luke Wong","Photo contributed","photo courtesy","Photo supplied","photofanatik","Photos by students of Wanarn Remote Community School WA","Picture Bundaberg","Pixie O'Harris","Portland Arts Centre","Publicity Still","Qld Fire and Rescue Service","Qld Museum","Quinn Rooney","QUT","R Kilpatrick","Rachael Lucas","Rachel Foutain","Rachel Lev","Rae Allen","Ralf Haertel","Ralph Snowball","Ray Bow","Ray McDermott","Ray Tyrrill","reaperman","Rebecca Brewin","Rebecca McLaren","Rebekah Rae","Red Dirt Camera Club.","Renee du Preez","Renni Maitland","RFDS","Rhett Hammerton","Rhiana Whitson","Rhonda Hair","Rhys Greedy","Rich Lam","Richard Dinnen","Richard Dunwoody","Richard Featherstone","Richard Glover","Richard Green","Richard Hall","Richard Insall","Richard Johnson","Richard Poulish","Richard Swinton","Richard Taylor","Rick Dawson","Rick Eaves","Rick Fenney","Riley Studio Photography","Ritchie Gilbert","Roanna Edwards","Rob Blackburn","Rob Blackmore","Rob Davis","Rob England","Rob Hagenaar","Rob Paxevanos","Robbert Westerdyk","Robbie and Tracey Wallace","Robert Crack","Robert Frith","Robert Lang","Robert Lang Photography","Robert Mailer","Robert Virtue","Robin Maguire","Robin Sellick","Rocky Barra Bounty","Rod Flintoff","Rodney Edwards","Roger Skinner","Roger Standen","Roisin McCann","Romane Cristescu","Ron Jupe","Ron York","Ronice Blair","Rosanna Ryan","Rose76","Rosii Pedler","Rosita Freeman","Roslyn Budd","Ross Anderson","Ross Driver","Ross Kay","Ross Robinson","Rottnest Island Authority","Rowan Bond","Royal Adelaide Hospital","RSPCA","RSPCA Cairns","Rubber Slippers","Ruslan Kulski","Russel Francis","Russell Ord","Ruth Byrne","Ruth Evans","Ruth Sandow","Sal Trethewey","Sally Bryant","Sally Knight","Sally Rope","Saltwater Freshwater Arts Alliance","Sam Davis","Sam Mckay","Sam Pedler","Samantha Turnbull","Samara Harris","Sandi Semmler","Sandra Miguel","Sandy Fleischer","Sapphires","Sara Polanski","Sarah Elliott","Sarah Gillman","Sarah Hamilton","Sarah Jozefiak","Sarah Knight","Sarah Moss","Sarah Ndiaye","Sarah Prout","Sarah Starkey","Sarah Voigt","Sarah Williams","Sascha Rundle","Sasha Cohen","Saul Goodwin","Scots College website","Scott Lamond","Scott Levi","Scott Rollinson","Scott Spark","Sean Blocksidge","Selena Gomersall","Selina Green","Serena Shaddick","Serenicom","serenicom (ABC Contribute)","shake and stir theatre co","Shane Blue","Shane Davis","Shane O'Brien","Shane Smith","Shannon Matzelle","Shark Bay Visitors Centre.","Sharnie Kim","Sharon Gordon","Sharon Kennedy","Sharon Kennedy and Ruslan Kulski","Sharon Matthies","Sharon Walls.","Shaun Talanskas","Shayne Witt","Sheba Also","Shepparton Art Museum","Sian Rebecca Stephenson","Simon Allard","Simon Fergusson","Simon Leo Brown","Simon Mossman","Simon Noble","Simon Penn","Simone Atallah","Simone Robinson","Skye Gannon","Skye Shannon","Smella Catshine","Smithsonian National Air and Space Museum","SMS submitted","Solua Middleton","Sonia Heap","Sophie Bartho","Sophie Benjamin","Sophie Brown","Sophie Connolly","Sophie Kesteven","South Australian Maritime Museum","South Australian Police Service","Spartacus Chetwynd","Spence Denny","Spowart and Cooper","Stacey King","Stacey Lee Harvey","Stacey Leigh Cash","Stacey Wemyss","Stan Moody Collection","Stan Shaw","State Library of NSW","Steen Shoar","Stefan Postles","Stefan Schutt","Stephanie Owen","Stephanie Watson","Stephen Holmes","Stephen Smiley","Stephen Walker","Steve Axford","Steve Bourne","Steve Cook","Steve Rutherford","Steve Starling","Steven O'Brien","Steven Pearce","Steven Raidis","Stinker","Stuart Fletcher","Stuart Haynes","Stuart Stansfield","Stuart Tatnell","Submitted","Sue Jarvis","Sui Jianguo","supacrush","Keith Cook","Phillip Island Boardriders Club","Reg Manning","Faye Vandyk","Susan Atkinson","Susan Hetherington","Susan Rooney-Harding","Susan Standen","Susan Steens","Susie Hagon","Suzannah Lyons","Suzi Taylor","Suzii Farnsworth","SWFW","Syan Dougherty","Talitha Rice","Tamara Binamat","Tamara Voninski","Tamblyn Models","Tankphotography.com","Tanya Greagen","Tara Goonan","Tara Reinke","Taronga Zoo","Tash Impey","Tasha Impey","Tasmanian Archive and Heritage Office","Tasmanian Museum and Art Gallery","Tavis Perry","TCC_News","Tegan Logos","Teresa ter Bogt","termccon","Terri Begley","Terri-Anne Kingsley","Terry Killalea-Hore","The Dance Centre Peregian Springs","The Greens","The Weighmaster","The Weir family of Cowra","Theresa Rockley-Hogan","Therese Phillips","Thornton Parker","Thursday's Child","Tiff Firth","Tim Baker","Tim Bennett, Yandell Walton","Tim Brunero","Tim Commons","Tim Gerritsen","Tim Jeanes","Tim Leha","Tim Leslie","Tim Noonan","Tim Simpson","Tim Walker","Tim Williams","TimmiGee","timobalk","Timothy Gibson","Timothy Marshall","Tina Clemens","Tindaltrader","Tom Coull","Tom Fedorowytsch","Tom Hearn","Tom Jessett","Tom Lowrey","Tom Ransley","Tommy B","Toni Wilkinson","Tony Lacey","Tony Robertson","Tracey Armstrong","Tracey Nearmy","Tracie Williams","Travis Anderson","Travis Fatchen","Travis Hayto","Trevor Campbell","Trevor Dickinson","Trevor Glass","Trevor Jackson","Trevor Prettejohn","Trevor Wilks","Trevor Wright","Tryphena Biddulph","Twitter @AusGeo","Tyler Boyd","Tyrone Spearim","University of Newcastle Cultural Collections","Ursula Montgomerie","Ursula Skjonnemand","Ursula Wharton","USC","UWA Cultural Precinct","Vanessa Bertagnole","Vanessa Mills","Vicki Bayata","Vicki Kerrigan","VicRoads","Victorian Snow Reporting Service","VicTrack ACCESS","Viktor Vasnetsov","Vince Steele","Virginia Hills","W Pedersen","W.E. Fretwell","WA Angels","WA Museum","Warwick Kemp","Warwick Long","Wayne Bigg","Wayne Davis","Wayne Grivell","Wayne Young","Wellcamp Airport","Wendy Bates","Wendy Chambers","Wendy Collis","Wendy Hawkes","Wendy Thorn","Western NSW Local Health District","Wikimedia","William Johnstone","Willie Davidson","Wiriya Sati","WJ Hassett","Woodcut by Frederick Grosse","Woodford Folk Festival","Wujal Wujal Police","Xavier La Canna","Yoshiya","Yvonne Cunningham","Zena Kells"];
		
		var i = 0;

		var intervalID = setInterval(function(){
			console.log("searching for number "+i+"... "+names[i])

			twit.arbitrary_to_database({
				call: "users/search",
				params: {
					q: names[i],
					count: 1,
					include_entities: false
				}
			}, function(d){})

			i++;
			if (i == names.length){
				clearInterval(intervalID);
			}
		}, 6000);
	}
}

exports.twit = twit;








