m0 = {
	"socket": io.connect(),
	"splash": {
		"init": function() {
			//hardcoded
			var w = m0.splash.w = 1600,
					h = m0.splash.h = 900,
					x = 0,
					y = 0,
					scaling = $('body').width() / w,
					scaling2 = $('body').height() / h;

			if(scaling2 < scaling){
				scaling = scaling2;
			}

			vis = d3.select("body")
				.append("div").attr("id", "minardo_div")
				.append("svg").attr("id", "page")
				.append("svg:g").attr("id", "vis")
					.attr("transform","scale("+scaling+")");
					
			var splash = vis.append("svg:g")
										.attr("id", "splash");
										
			splash.append("svg:rect")
				.attr("x", x)
				.attr("y", y)
				.attr("width", w)
				.attr("height", h)
				.classed("splashBackground", true);

			splash.append("image")
				.attr("width",640)
				.attr("height",300)
				.attr("x", (w-640)/2)
				.attr("y", 100)
				.attr("xlink:href", "/minardo/images/minardo_logo.png")

			var dx = w*.2,
					dy = h*.6,
					demo = splash.append("svg:g").attr("id", "demoButton")
						.attr("transform", "matrix(1 0 0 1 "+dx+" "+dy+")")
						.on("click", demo);
			
			demo.append("svg:rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", w*.2)
				.attr("height", h*.2)
				.attr("fill", "white")
				.attr("stroke", "black")
				
			demo.append("svg:text")
				.text("Demo data")
				.style("font-size", 36)
				.attr("x", 10)
				.attr("y", 50)

			var lx = w*.6,
					load = splash.append("svg:g").attr("id", "loadButton")
						.attr("transform", "matrix(1 0 0 1 "+lx+" "+dy+")")
						.on("click", load);
			
			load.append("svg:rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", w*.2)
				.attr("height", h*.2)
				.attr("fill", "white")
				.attr("stroke", "black")
				
			load.append("svg:text")
				.text("Load own data")
				.style("font-size", 36)
				.attr("x", 10)
				.attr("y", 50)
			function demo(){
				m0.data.init("1LqCKq1KJrDi9vHXJNSp7GhjGVjZ4bAKWY43e9fBgHEA");
			}
			function load(){
				alert("lolol not ready yet");
			}
		}
	},
	"data": {
		"loaded": false,
		"init": function(key){
			console.log("init data");
			window.history.pushState({},"", key);
			m0.socket.on("m0_data", function(d){
				m0.data.d = d;
				if(d == null){
					alert("Error. Please 'share' your google doc spreadsheet with minardoapp@gmail.com");
				} else if (!m0.data.loaded){

	//				console.log(d);
					// get the data...
					// store it
					// calculate time points?
					// various housekeeping things....
					m0.data.activation = {};
					m0.data.protein = {};
					m0.data.sites = Object.keys(d.pathway);
					//calculate point of first activation here!
					m0.data.sites.forEach(function(site){
						var time = .15,
								i = 0,
								s = d.timeseries[site];
						if(typeof s != 'undefined'){
							if(s[0] <= 50){
						//		console.log("phosphorylation");
								while(s[i] <= 50){i++}
								var big = s[i],
										small = s[i-1],
										gap = 50 - small,
										diff = big - small,
										ratio = gap/diff;
								time = (i-1) + ratio;
							} else {
						//		console.log("de-phosphorylation");
								while(s[i] >= 50){i++}
								var big = s[i-1],
										small = s[i],
										gap = 50 - small,
										diff = big - small,
										ratio = gap/diff;
								time = (i-1) + ratio;
							}
						}
					m0.data.activation[site] = time;

				
					//make proteins lookup table...
					var uniprot = m0.data.d.metadata[site].uniprot;
					if (uniprot) {
						if(m0.data.protein[uniprot]) {
							m0.data.protein[uniprot].push(site);
						} else {
							m0.data.protein[uniprot] = [site];
						}
					}
					});

					//count the number of time points, and record it once.
					m0.data.numberOfTimePoints = m0.data.d.timeseries[Object.keys(m0.data.d.timeseries)[0]].length;

					// house keeping...
					// make sure kinase and substrate groups are in both sets..
					//also make a substrate lookup table.
					// I want to be able to enter a site, and find out it's kinase.
					m0.data.substrateReverseLookup = {};
					m0.data.kinaseReverseLookup = {};
					m0.data.tracks = {};
					m0.data.nodes = {};
					Object.keys(m0.data.d.kinases).forEach(function(group){
						if(typeof m0.data.d.substrates[group] == 'undefined'){
							m0.data.d.substrates[group] = [];
						}
						m0.data.d.kinases[group].forEach(function(site){
							m0.data.kinaseReverseLookup[site] = group;
						});
					});
					Object.keys(m0.data.d.substrates).forEach(function(group){
						if(typeof m0.data.d.kinases[group] == 'undefined'){
							m0.data.d.kinases[group] = [];
						}
						m0.data.d.substrates[group].forEach(function(site){
							m0.data.substrateReverseLookup[site] = group;
						});
					});

					m0.data.loaded = true;
					m0.racetrack.init();
					m0.heatmap.init();
					m0.interaction.init();
				}
			});
			m0.socket.emit("m0_load",{key:key});
		},
		"getSizesOfTimePoints": function () {
			var sectorSizes = {};
			m0.data.sites.forEach(function(site){
				var timepoint = Math.floor(m0.data.activation[site]);
				if (typeof sectorSizes[timepoint] == 'undefined'){
					sectorSizes[timepoint] = 1;
				} else {
					sectorSizes[timepoint]++;
				}
			});
			return sectorSizes;
		},
		"getMostActiveKinases": function(){
			return Object.keys(m0.data.d.kinases).sort(function(a,b){
				return (m0.data.d.substrates[b].length +
				 m0.data.d.kinases[b].length) -
				(m0.data.d.substrates[a].length +
				 m0.data.d.kinases[a].length);
			});
		},
		"getLimits": function(kinase, floor){
			var first = m0.data.numberOfTimePoints,
					last = 0,
					point = null;

			m0.data.d.kinases[kinase].forEach(function(site){
				if(floor){
					point = Math.floor(m0.data.activation[site]);
				} else {
					point = m0.data.activation[site];
				}
				if(point > last) { last = point; }
				if(point < first) { first = point; }
			});

			m0.data.d.substrates[kinase].forEach(function(site){
				if(floor){
					point = Math.floor(m0.data.activation[site]);
				} else {
					point = m0.data.activation[site];
				}
				if(point > last) { last = point; }
				if(point < first) { first = point; }
			});

			return {first: first, last:last};
		}
	},
	"racetrack": {
		"init": function(){
			d3.select("#splash").remove();
			console.log("init racetrack");
			
			var vis = d3.select("#vis"),
					w = m0.splash.w - 200, //hardcoded
					h = m0.splash.h - 100,
					x = 0,
					y = 0;

			vis.append("svg:defs")
				.append("svg:marker")
					.attr("id", "arrowhead")
					.attr("orient", "auto")
					.attr("markerWidth", 20)
					.attr("markerHeight", 40)
					.attr("refX", 8)
					.attr("refY", 8)
				.append("path")
					.attr("d", "M0,0 V16 L8,8 Z")
					.attr("fill", "red");

			var racetrack = vis.append("svg:g")
				.attr("id", "racetrack")
				.attr("transform", "matrix(1 0 0 1 "+x+" "+y+")")
				.attr("x", x)
				.attr("y", y)
				.attr("width", w)
				.attr("height", h);

			var backdrop = m0.racetrack.createBackdrop(w, h);
			m0.racetrack.sectors = m0.racetrack.createSectors();

			// find the biggest entities. or most active kinases..?
			// draw tracks with them.
			// draw the rest of everything!

			var kinases = m0.data.getMostActiveKinases();
			//console.log(kinases);
			//hardcoded
			m0.racetrack.draw(kinases, 9);
		},
		"drawn": {},
		"draw": function(kinases, numberOfTracks){
			d3.select("#racetrack").append("svg:g").attr("id", "tracks");
			d3.select("#racetrack").append("svg:g").attr("id", "nodes");
			d3.select("#racetrack").append("svg:g").attr("id", "links");
			m0.data.sites.forEach(function(site){
				m0.racetrack.drawn[site] = false;
			});
			m0.racetrack.rails = rails = [];
			for(var i = 0; i < numberOfTracks; i++){
				rails[i] = [];
				for(var j = 0; j < m0.data.numberOfTimePoints; j++){
					rails[i].push(false);
				}
			}

			// allocate space in rails for tracks...
			kinases.forEach(function(kinase){
				var limits = m0.data.getLimits(kinase, true);
				var track = allocateSpace(rails, limits, kinase);
			});
			
			rails.forEach(function(rail, i){
				drawRail(rail, i, numberOfTracks);
			});

			var nodeCounter = 0;
			Object.keys(m0.racetrack.drawn).forEach(function(site){
				if(!m0.racetrack.drawn[site]){
					drawNode(site);
				}
			});

			//grab every substrate.
			//draw a link for it.
			var linkNumber = 0;
			Object.keys(m0.data.substrateReverseLookup).forEach(function(site){
				drawLink(site);
			});
			
			function allocateSpace(rails, limits, kinase){
//				console.log('hey');
				var rail = null;
//kind of broken... limits.last should be extended by 1 to make this algo work properly and avoid overlaps, because limits have been floored. i.e. 5.9 is reduced to 5
//this is a hack
limits.last++;

				for(var i = 0; i < rails.length && rail == null; i++){
					for(var j = limits.first;	j <= limits.last &&
																		rail == null &&
																		!rails[i][j]; j++){
						if(j == limits.last){
							rail = i;
							for(var k = limits.first; k < limits.last; k++){
								rails[i][k] = kinase;
							}
						}
					}
				}
				return rail;
			}
			function drawRail(rail, i, n){
				//hardcoded
				var r = ((2+i) * m0.racetrack.height) / 27;
				var vis = d3.select("#tracks")
					.append("svg:g")
					.attr("id", "rail-"+i);

				var kinases = getKinasesOfTrack(rail);
				kinases.forEach(function(kinase){
					var limits = m0.data.getLimits(kinase, false),
							d3object = drawTrack(kinase, r, limits);
					m0.data.tracks[kinase] = {
						'd3object': d3object,
						'sites': [],
						'r': r,
						'railNumber': i
					}
					m0.data.d.kinases[kinase].forEach(function(site){
						m0.data.nodes[site] = m0.data.tracks[kinase];
						m0.data.tracks[kinase].sites.push(site);
						m0.racetrack.drawn[site] = d3object;
					});
				});

				function drawTrack(kinase, r, limits){
					 var pathPoints = m0.racetrack.sectors.getPathPoints(r, limits),
					     track = vis.append("svg:g").attr("id", "track-"+kinase),
					     start = m0.racetrack.sectors.getPosOf(limits.first, r);
						
						track.append("svg:path")
							.classed("link", true)
							.classed("track", true)
							.attr("d", pathPoints);

						track.append("text")
							.text(kinase)
							.classed("label", true)
							.attr("x", start.x)
							.attr("y", start.y);

//console.log(start);

					return track;
				}
				function getKinasesOfTrack(track){
					var kinases = {};
					track.forEach(function(place){
						if(place){
							kinases[place] = true;
						}
					});
					return Object.keys(kinases);
				}
			}
			function drawNode(site){
				var vis = d3.select("#nodes"),
						act = m0.data.activation[site],
						h2 = m0.racetrack.height * .4,
						r = h2 * Math.random(),
						kinase = null;

				if (m0.data.substrateReverseLookup[site] &&
						m0.data.tracks[m0.data.substrateReverseLookup[site]]
				){
					kinase = m0.data.substrateReverseLookup[site];
					r = m0.data.tracks[kinase].r - 30; //hardcode
				}

				var pos = m0.racetrack.sectors.getPosOf(act, r);

				
				m0.data.nodes[site] = {
					'pos': pos,
					'd3object': buildNode(),
					'nodeNumber': nodeCounter,
					'kinase': kinase,
					'node': true
				}


				function buildNode(){
					//hardcode
					var w = 48,//m0.racetrack.width * .025,
							h = 25,//m0.racetrack.height * .025,
							node = vis.append("svg:g")
								.attr("id", "node-"+nodeCounter++)
								.classed("node-"+site, true)
								.classed("node", true)
								.attr("transform", "matrix(1 0 0 1 "+pos.x+" "+pos.y+")");
							name = m0.data.d.pathway[site].name,
							comment = m0.data.d.pathway[site].comment,
							uniprot = m0.data.d.metadata[site].uniprot,
							residue = m0.data.d.metadata[site].aa +"-"+m0.data.d.metadata[site].pos;


					node.append("svg:rect")
						.attr("x", 0 - (w/2))
						.attr("y", 0 - (h/2))
						.attr("width", w)
						.attr("height", h)
						.attr("fill", "white")
						.attr("stroke", "black");
					
					//hardcoded
					node.append("text")
						.text(name)
						.attr("x", 0 - (w/2) + 2)
						.attr("y", 0 - (h/2) + 11)	
										
					node.append("text")
						.text(residue)
						.attr("x", 0 - (w/2) + 3)
						.attr("y", 0 - (h/2) + 22)
/*					node.append("text")
						.text(comment)
						.attr("x", 0 - (w/2) + 3)
						.attr("y", 0 - (h/2) + 27)*/
					m0.racetrack.drawn[site] = node;
					return node;
					function callback(){
						console.log("clicked!");
						m0.interaction.click();
//						var win = window.open("http://www.uniprot.org/uniprot/"+uniprot);
					}
				}
			}
			function drawLink(site){
				var node = m0.data.nodes[site],
						kinase = m0.data.substrateReverseLookup[site],
						place = m0.data.activation[site],
						start = false,
						end = false;
var a = false;
//note, not every kinase has a track all the time........
if (Object.keys(m0.data.tracks).indexOf(kinase) >= 0){
// kinase is a track!
	start = m0.racetrack.sectors.getPosOf(place, m0.data.tracks[kinase].r);
} else if(node.pos){
// kinase is not a track!
	start = closestNodeTo(node, kinase);
} else {
	console.log("broken here");
	console.log(node);
	var fakenode = {pos: m0.racetrack.sectors.getPosOf(m0.data.activation[site], node.r)}

	console.log(fakenode);
	start = closestNodeTo(fakenode, kinase);
	
	//broken
// substrate is a track, but kinase might not be a track...
//	var track = m0.data.kinaseReverseLookup[site];
//	var kinaseNode = m0.data.d.kinases[kinase][0]
	a = true;
//	console.log('wtf');
//	console.log("get start for "+site);
//	console.log("kinase: "+ kinase);
//	console.log(start);
}
//get endpoint
if(typeof node.node == 'undefined'){
	//site is in a track
	end = m0.racetrack.sectors.getPosOf(place, node.r);
} else{
	//site is a node
	end = node.pos;
}

if(a){console.log(end), console.log(start), console.log(linkNumber)}

if(start && end){
	if(m0.data.kinaseReverseLookup[site] == kinase){
//		console.log(kinase+' hits itself');
//	console.log(start);
//	console.log(end);
		var e1 = end.x + 11,
				e2 = end.y;
		d3.select("#links")
			.append("svg:path")
			.attr("id", "link-"+linkNumber++)
			.attr("d", "M "+start.x+","+start.y+"A10 10 0 1 1"+e1+" "+e2)
			.classed("link", true)
			.classed("lol", true)
			.attr("marker-end", "url(#arrowhead)");
	} else {
	//normal behaviour.

		d3.select("#links")
			.append("svg:path")
			.attr("id", "link-"+linkNumber++)
			.attr("d", "M "+start.x+","+start.y+" L "+end.x+","+end.y)
			.classed("link", true)
			.attr("marker-end", "url(#arrowhead)");
	}
}

function closestNodeTo(node, kinase){
	var closestPos = null,
			distance = Number.MAX_SAFE_INTEGER

	m0.data.d.kinases[kinase].forEach(function(site){
		var x = m0.data.nodes[site].pos.x - node.pos.x,
				y = m0.data.nodes[site].pos.y - node.pos.y,
				d = Math.sqrt(x*x+y*y);
		if(d < distance){
			distance = d;
			closestPos = m0.data.nodes[site].pos;
		}
	});
	return closestPos;
}
			}
		},
		"createBackdrop": function(w, h){
m0.racetrack.width = w;
m0.racetrack.height = h;
var r = d3.select("#racetrack");


var	background = r.append("svg:g")
		.attr("id", "background");
background.append("svg:rect")
	.classed("racetrackBackground", true)
	.attr("width", w)
	.attr("height", h);



var area_1 = background.append("svg:g")
	.attr("id", "area_1")
	.classed("area", true);
var area_0 = background.append("svg:g")
	.attr("id", "area_0")
	.classed("area", true)
	.attr("transform", "matrix(1 0 0 -1 0 "+(h/2)+")");
var area_2 = background.append("svg:g")
	.attr("id", "area_2")
	.classed("area", true);

var backdrop = {
	"background": background,
	"areas": [area_0, area_1, area_2],
	"getDimensions": function (area_number, complex){
		var dim = {
			"x": 0,
			"y": 0,
			"w": 0,
			"h": 0
		};
		if(area_number == 0){
			dim.x = 0;
			dim.y = 0;
			dim.h = h / 2;
			dim.w = w - dim.h;
		} else if (area_number == 1){
			dim.h = h / 2;
			dim.w = h / 2;
			dim.x = w - dim.w;
			dim.y = dim.w;
		} else if (area_number == 2){
			dim.x = 0;
			dim.h = h / 2;
			dim.y = dim.h;
			dim.w = w - dim.h;
		}
		
		if (complex == "membrane") {
			dim.h = dim.h * .8;
		} else if (complex == "cytoplasm") {
			dim.h = dim.h * .7;
		} else if (complex == "nucleus") {
			dim.h = dim.h * .15;
		}
		return dim;
	},
	"width": w,
	"height": h
};

backdrop.areas.forEach(function(area, i){
	buildArea(area, i);
});

function buildArea(area, number){
	if (number != 1) {
	
		area.append("svg:g")
			.classed("membrane", true)
		.append("svg:rect")
			.attr("width", backdrop.getDimensions(number, "membrane").w)
			.attr("height", backdrop.getDimensions(number, "membrane").h)
			.attr("x", backdrop.getDimensions(number, "membrane").x)
			.attr("y", backdrop.getDimensions(number, "membrane").y);

		area.append("svg:g")
			.classed("cytoplasm", true)
		.append("svg:rect")
			.attr("width", backdrop.getDimensions(number, "cytoplasm").w)
			.attr("height", backdrop.getDimensions(number, "cytoplasm").h)
			.attr("x", backdrop.getDimensions(number, "cytoplasm").x)
			.attr("y", backdrop.getDimensions(number, "cytoplasm").y);

		area.append("svg:g")
			.classed("nucleus", true)
		.append("svg:rect")
			.attr("width", backdrop.getDimensions(number, "nucleus").w)
			.attr("height", backdrop.getDimensions(number, "nucleus").h)
			.attr("x", backdrop.getDimensions(number, "nucleus").x)
			.attr("y", backdrop.getDimensions(number, "nucleus").y);
	} else {
		area.append("svg:g")
			.classed("membrane", true)
		.append("svg:circle")
			.attr("r", backdrop.getDimensions(number, "membrane").h)
			.attr("cx", backdrop.getDimensions(number, "membrane").x)
			.attr("cy", backdrop.getDimensions(number, "membrane").y);

		area.append("svg:g")
			.classed("cytoplasm", true)
		.append("svg:circle")
			.attr("r", backdrop.getDimensions(number, "cytoplasm").h)
			.attr("cx", backdrop.getDimensions(number, "cytoplasm").x)
			.attr("cy", backdrop.getDimensions(number, "cytoplasm").y);


		area.append("svg:g")
			.classed("nucleus", true)
		.append("svg:circle")
			.attr("r", backdrop.getDimensions(number, "nucleus").h)
			.attr("cx", backdrop.getDimensions(number, "nucleus").x)
			.attr("cy", backdrop.getDimensions(number, "nucleus").y);
	}
}

return backdrop;
},
		"createSectors": function(){
			var sectors = {},
					nSectors = m0.data.numberOfTimePoints,
					nPoints = m0.data.sites.length,
					sSize = m0.data.getSizesOfTimePoints(),
					sPercent = {}
					a = [0,0,0];

			for (var i = 0; i < nSectors; i++){
				if (typeof sSize[i] == "number") {
					sPercent[i] = (sSize[i] + 5) / (nPoints + 5 * nSectors);
				} else {
					sPercent[i] = 5 / (nPoints + 5 * nSectors);
				}
			}
		
			var r = this.height * .4;
			var w = this.width - (this.height / 2);
			var h = this.height * .8;
			var h2 = h/2;

			var totalArea = ((Math.PI * r * r) / 2) + w * h;

			var sArea = {};
			Object.keys(sPercent).forEach(function (sector){
				sArea[sector] = sPercent[sector] * totalArea;
			});


			// we now know how big each sector should be
			// now go and allot each sector......
			var area = {};
			area[0] = w * h/2;
			area[1] = Math.PI * r * r / 2;
			area[2] = w * h/2;
			var c = 0;

			Object.keys(sArea).forEach(function (s){
				var sector = {"timepoint": s};
				if (Math.floor(area[c]) >= Math.floor(sArea[s])) {
					sector = allocateSector(c, sArea[s], sector);
					area[c] = area[c] - sArea[s];
				} else {
					sector = allocateSector(c, area[c], sector);
					var temp = sArea[s] - area[c];
					c++;
					if (Math.floor(temp) <= Math.floor(area[c])) {
						sector = allocateSector(c, temp, sector);
						area[c] = area[c] - temp;
					} else {
						var temp2 = temp - area[c];
						sector = allocateSector(c, area[c], sector);
						c++;
						sector = allocateSector(c, temp2, sector);
						area[c] = area[c] - temp2;
					}
				}
				sectors[s] = sector;
			});

	//		var a = [0,0,0]; //I want this to be local!!!
			function allocateSector(area, sectorArea, sectorDetails){
				sectorDetails[area] = {};
				if (area == 0) {
					sectorDetails[area]['x'] = a[area]/h2;
					sectorDetails[area]['y'] = m0.racetrack.height*.1;
					sectorDetails[area]['w'] = sectorArea/h2;
					sectorDetails[area]['h'] = h2;
					sectorDetails[area]['area'] = sectorArea;
				} else if (area == 1) {
					sectorDetails[area]['cx'] = m0.racetrack.width - (m0.racetrack.height /2);
					sectorDetails[area]['cy'] = m0.racetrack.height /2;
					sectorDetails[area]['startAngle'] = 2*a[area]/(r*r);
					sectorDetails[area]['finishAngle'] = (2*(a[area]+sectorArea))/(r*r);
					sectorDetails[area]['r'] = r;
					sectorDetails[area]['area'] = sectorArea;
				} else if (area == 2) {
					sectorDetails[area]['x'] = (m0.racetrack.width - (m0.racetrack.height /2)) - (a[area]/h2 + sectorArea/h2);
					sectorDetails[area]['y'] = m0.racetrack.height/2;
					sectorDetails[area]['w'] = sectorArea/h2;
					sectorDetails[area]['h'] = h2;
					sectorDetails[area]['area'] = sectorArea;
				}

				a[area] += sectorArea;
				return sectorDetails;
			};

			//draw sectors...
			var sg = d3.select("#racetrack").append("svg:g").attr("id", "sectors");
	//			.on("mouseout", MINARDO.racetrack.mouseout);
		
			Object.keys(sectors).forEach(function(sector){
				var s = sectors[sector];
				var g = sg.append("svg:g").attr("id", "sector-"+sector).classed("sectorGroup", true);
				var pieces = Object.keys(s).length - 1;

				if (pieces == 1){
					if (typeof s[0] == 'object') {
						g.append("svg:rect")
							.attr("x", s[0]['x'])
							.attr("y", s[0]['y'])
							.attr("width", s[0]['w'])
							.attr("height", s[0]['h'])
							.classed("sector", true);
					} else if (typeof s[1] == 'object') {
						var mX = s[1]['cx'];
						var mY = s[1]['cy'];
						var sX = (r * Math.sin(s[1].startAngle));
						var sY = -(r * Math.cos(s[1].startAngle));
						var eX = (r * Math.sin(s[1].finishAngle)) - sX;
						var eY = -(r * Math.cos(s[1].finishAngle)) - sY;
	//console.log(mX,mY);
	//console.log(sX,sY);
	//console.log(eX,eY);
						g.append("svg:path")
							.attr("d", "M "+mX+","+mY+" l "+sX+","+sY+" a"+h2+","+h2+" 0 0,1 "+eX+","+eY+" z")
							.classed("sector", true);
					} else if (typeof s[2] == 'object') {
						g.append("svg:rect")
							.attr("x", s[2]['x'])
							.attr("y", s[2]['y'])
							.attr("width", s[2]['w'])
							.attr("height", s[2]['h'])
							.classed("sector", true);
					}
				} else if (pieces == 2) {
					if (typeof s[0] == 'object') {
						// draw a shape with 5 coordinates.
						// 4 straight lines, one angle
						var c1x = s[1]['cx'];
						var c1y = s[1]['cy'];
						var c2x = s[0]['x'] - c1x;
						var c2y = s[0]['y']+s[0]['h'] - c1y;
						var c3x = 0;
						var c3y = c2y - s[0]['h'];
						var c4x = s[0]['w'];
						var c4y = 0;
						var c5x = (r * Math.sin(s[1].finishAngle));
						var c5y = s[0]['h']-(r * Math.cos(s[1].finishAngle));

						g.append("svg:path")
							.attr("d", "M "+c1x+","+c1y+" l "+c2x+","+c2y+" "+c3x+","+c3y+" "+c4x+","+c4y+" a"+h2+","+h2+" 0 0,1 "+c5x+","+c5y+" z")
							.classed("sector", true);


					} else if (typeof s[1] == 'object') {

						// draw a shape with 5 coordinates.
						// 4 straight lines, one angle
						var c1x = s[1]['cx'];
						var c1y = s[1]['cy'];
						var c2x = s[2]['x'] - c1x;
						var c2y = 0;
						var c3x = 0;
						var c3y = c2y + s[2]['h'];
						var c4x = s[2]['w'];
						var c4y = 0;
						var c5x = (r * Math.sin(s[1].startAngle));
						var c5y = 0-(r * Math.cos(s[1].startAngle))-s[2]['h'];

						g.append("svg:path")
							.attr("d", "M "+c1x+","+c1y+" l "+c2x+","+c2y+" "+c3x+","+c3y+" "+c4x+","+c4y+" a"+h2+","+h2+" 0 0,0 "+c5x+","+c5y+" z")
							.classed("sector", true);

					} else {
						console.log("something is wrong");
					}
				} else if (pieces == 3) {
					// this case doesn't exist yet... i should write it anyway...
					// maybe another day
					var c1x = s[0].x,
							c1y = s[0].y + s[0].h,
							c2x = s[0].x,
							c2y = s[0].y,
							c3x = s[0].x + s[0].w,
							c3y = s[0].y,
							c4x = s[2].x + s[2].w,
							c4y = s[2].y + s[2].h,
							c5x = s[2].x,
							c5y = s[2].y + s[2].h,
							c6x = s[2].x,
							c6y = s[2].y;
					g.append("svg:path")
						.attr("d", "M"+c1x+","+c1y+"L"+c2x+","+c2y+" "+c3x+","+c3y+
											 "A1 1 0 0 1 "+c4x+" "+c4y+
											 "L"+c5x+","+c5y+" "+c6x+","+c6y+"z");
				}

			g.data([s]);
	//		MINARDO.racetrack.sectorSizes.push(s);
			});

//			console.log(sectors);
			sectors.getPosOf = function (position, r){
						// h2 is the radius thing...
				var pos = {},
						area = null,
						sector = sectors[Math.floor(position)],
						percent = position % 1,
						totalArea = totalAreaOf(sector),
						midway = m0.racetrack.height / 2;
//				console.log(sector);
				if(sector[1]){
					if (sector[0]){
						if(sector[2]){
							// sector 0, 1 & 2
							if(percent * totalArea > sector[0].area){
								var a = (totalArea * percent) - sector[0].area;
								if(a > sector[1].area){
									//sector 2
									area = 2;
									var a = (totalArea * percent) - sector[0].area - sector[1].area,
											p = a / sector[2].area;
											pos.y = midway + r;
											pos.x = (sector[2].x + sector[2].w) - (p * sector[2].w);
								} else {
									//sector 1
									area = 1;
									var p = a / sector[1].area;
									pos.angle = sector[1].finishAngle * p;
								}
							} else {
								//sector 0
								area = 0;
								pos.y = midway - r;
								pos.x = sector[0].x + (percent * sector[0].w);
							}
						} else {
							// sector 0 & 1
							if(percent * totalArea > sector[0].area){
								//sector 1
								area = 1;
								var a = (totalArea * percent) - sector[0].area,
										p = a / sector[1].area;
								pos.angle = sector[1].finishAngle * p;
							} else {
								//sector 0
								area = 0;
								pos.y = midway - r;
								pos.x = sector[0].x + (percent * sector[0].w);
							}
						}
					} else if (sector[2]){
						// sector 1 & 2
						if (percent * totalArea > sector[1].area) {
							//sector 2
							area = 2;
							var a = (totalArea * percent) - sector[1].area,
									p = a / sector[2].area;
							pos.y = midway + r;
							pos.x = (sector[2].x + sector[2].w) - (p * sector[2].w);
						} else {
							//sector 1
							area = 1;
							pos.angle = ((sector[1].finishAngle - sector[1].startAngle) * percent) + sector[1].startAngle;
						}
					} else {
						// sector 1 only
						area = 1;
						pos.angle = ((sector[1].finishAngle - sector[1].startAngle) * percent) + sector[1].startAngle;
					}
				} else if (sector[0]){
					//sector 0
					area = 0;
					pos.y = midway - r;
					pos.x = sector[0].x + (percent * sector[0].w);
				} else if (sector[2]){
					//sector 2
					area = 2;
					pos.y = midway + r;
					pos.x = (sector[2].x + sector[2].w) - (percent * sector[2].w);
				}
				pos.area = area;
				if(area == 1){
					pos.x = w + r * Math.sin(pos.angle);
					pos.y = midway - r * Math.cos(pos.angle);
				}
				pos.r = r;
				return pos;
			}
			sectors.getPathPoints = function(r, limits){
				var path = null,
						sA = sectors.getPosOf(limits.first, r),
						fA = sectors.getPosOf(limits.last, r)
						sB = sectors.getPosOf(limits.first, (r+4)),
						fB = sectors.getPosOf(limits.last, (r+4));
						//w = m0.racetrack.width - (m0.racetrack.height / 2)

				if (sA.area == 0){
					if (fA.area == 0){
						path = "M"+sA.x+","+sA.y+"L"+fA.x+","+fA.y+
									 " "+fB.x+","+fB.y+" "+sB.x+","+sB.y+"z";
					} else if (fA.area == 1){
						path = "M"+sA.x+","+sA.y+"L"+w+","+sA.y+
									 "A"+fA.r+" "+fA.r+" 0 0 1 "+fA.x+" "+fA.y+
									 "L"+fB.x+","+fB.y+
									 "A"+fB.r+" "+fB.r+" 0 0 0 "+w+" "+sB.y+
									 "L"+sB.x+","+sB.y+"z";
					} else {
						path = "M"+sA.x+","+sA.y+"L"+w+","+sA.y+
									 "A"+sA.r+" "+sA.r+" 0 0 1 "+w+" "+fA.y+
									 "L"+fA.x+","+fA.y+
									 " "+fB.x+","+fB.y+" "+w+","+fB.y+
									 "A"+fB.r+" "+fB.r+" 0 0 0 "+w+" "+sB.y+
									 "L"+sB.x+","+sB.y+"z";
					}
				} else if (sA.area == 1){
					if (fA.area == 1){
					path = "M"+sA.x+","+sA.y+
								 "A"+sA.r+" "+sA.r+" 0 0 1 "+fA.x+" "+fA.y+
								 "L"+fA.x+","+fA.y+
								 "A"+fA.r+" "+fA.r+" 0 0 0 "+sB.x+" "+sB.y+"z";
					} else {
					path = "M"+sA.x+","+sA.y+
								 "A"+sA.r+" "+sA.r+" 0 0 1 "+w+" "+fA.y+
								 "L"+fA.x+","+fA.y+
								 " "+fB.x+","+fB.y+" "+w+","+fB.y+
								 "A"+sB.r+","+sB.r+" 0 0 0 "+sB.x+" "+sB.y+"z";
					}
				} else if (sA.area == 2){
					path = "M"+sA.x+","+sA.y+"L"+fA.x+","+fA.y+
								 " "+fB.x+","+fB.y+" "+sB.x+","+sB.y+"z";
				}
				return path;
			}
//			console.log(sectors);
			labelSectors();

			return sectors;
			function totalAreaOf(sector){
				var totalArea = 0;
				if(typeof sector[0] != 'undefined'){
					totalArea += sector[0].area;
				}
				if(typeof sector[1] != 'undefined'){
					totalArea += sector[1].area;
				}
				if(typeof sector[2] != 'undefined'){
					totalArea += sector[2].area;
				}
				return totalArea;
			}
			function labelSectors(){
				var r = m0.racetrack.height * .42;
//				console.log(m0.data.numberOfTimePoints);
				for(var i = 0; i < m0.data.numberOfTimePoints; i++){
					var pos = sectors.getPosOf(i+0.5, r);
					d3.select("#sector-"+i).append("text")
							.text(m0.data.d.timepoints[i])
							.classed("label", true)
							.attr("x", pos.x - 12) //hardcoded
							.attr("y", pos.y);
				}
			}
		}
	},
	"heatmap":{
		"init": function(){
		}
	},
	"interaction": {
		"init": function(){
			console.log("init interactions");
			var w = m0.racetrack.width,
					h = m0.racetrack.height,
					e = 100, //hardcoded
					x = 0,
					y = 0;
			createButtons();
			createSelection();
			function createButtons(){
				vis = d3.select("#vis")
					.append("svg:g").attr("id", "buttons")
					.attr("transform", "matrix(1 0 0 1 0 "+h+")");

				vis.append("svg:rect")
					.attr("x", 0)
					.attr("y", 0)
					.attr("width", w+ 2*e)
					.attr("height", e)
					.classed("buttonBackground", true);
			
				drawButton(1, "Move", m0.interaction.move);
				drawButton(1, "Edit", m0.interaction.edit);
				drawButton(1, "Add", m0.interaction.add);
				drawButton(1, "Remove", m0.interaction.remove);
				drawButton(1, "Save", m0.interaction.save);
				drawButton(1, "Load", m0.interaction.load);
			
				function drawButton(size, text, callback){
					vis.append("svg:rect")
						.attr("id", "button-"+text)
						.attr("x", x+(e*.1))
						.attr("y", y+(e*.1))
						.attr("width", e * size *.8)
						.attr("height", e *.8)
						.attr("fill", "white")
						.attr("stroke", "black")
						.on("click", callback);
				
					vis.append("svg:text")
						.classed("buttonText", true)
						.text(text)
						.attr("x", x+2+(e*.1))
						.attr("y", y+17+(e*.1));
					x += e
				}
			}
			function createSelection(){
				vis = d3.select("#vis")
					.append("svg:g").attr("id", "selection")
					.attr("transform", "matrix(1 0 0 1 "+w+" 0)");

				vis.append("svg:rect")
					.attr("x", 0)
					.attr("y", 0)
					.attr("width", e * 2)
					.attr("height", h)
					.classed("selectionBackground", true);
				
				vis.append("svg:rect")
					.attr("x", (e*.2))
					.attr("y", (e*.2))
					.attr("width", (e *1.6))
					.attr("height", (h * .95))	//weird...
					.attr("fill", "white")
					.attr("stroke", "black")
					
				vis.append("svg:text")
					.text("Selected")
					.classed("listTitle", true)
					.attr("x", e*.3) //hardcoded
					.attr("y", e*.5) //hacked fix this

				vis.append("svg:text")
					.text("Phosphosites")
					.classed("listTitle", true)
					.attr("x", e*.3) //hardcoded
					.attr("y", e*.75) //hacked fix this


				vis.append("svg:g").attr("id", "list");

				initSelections();
			}
			function initSelections(){
				console.log("init selection");
				var list = {};
				Object.keys(m0.racetrack.drawn).forEach(function(thing){
					m0.racetrack.drawn[thing].on("click", m0.interaction.click);
				});





				function add(id){
					list[id] = true;
					d3.select("#"+id).classed("selected", true);
					update();
				}
				function remove(id){
					delete list[id];
					d3.select("#"+id).classed("selected", false);
					update();
				}
				function clear(){
					list = {};
					d3.selectAll(".selected").classed("selected", false);
					update();
				}
				function update(){
					d3.select("#list").remove();
					var vis = d3.select("#selection")
						.append("svg:g")
						.attr("id", "list")
						.attr("transform", "matrix(1 0 0 1 30 90)"),
							x = 0,
							y = 20;
					
					Object.keys(list).forEach(function(item, i){
						vis.append("svg:text")
							.text(item)
							.attr("x", x)
							.attr("y", y * i);
					});
				}

				m0.interaction.selection = {
					"list": list,
					"add": add,
					"remove": remove,
					"clear": clear,
					"update": update
				}
			}
		},
		"click": function(){
			//master click function....
			//select if not selected
//			console.log(d3.event);
			var id = d3.select(this).attr("id");
//			console.log(id);
			if(m0.interaction.selection.list[id]){
				m0.interaction.selection.remove(id);
			} else {
				m0.interaction.selection.add(id);
			}
//			m0.
		},
		"move": function(){
			console.log("hey");
		},
		"edit": function(){},
		"add": function(){},
		"remove": function(){},
		"save": function(){},
		"load": function(){},
	}
}













































































