// racetrack file........

var MINARDO = MINARDO || {};

a = [0,0,0]; // global... this is bad... used for function allocateSector();

socket = io.connect();
//socket.emit("minardo_load", {});

socket.on("minardo_data",function(d){
	console.log(d);
	Object.keys(d).forEach(function (node){
		MINARDO.racetrack.hoverBox.updateNode(MINARDO.racetrack.blobs[node], [d[node].x, d[node].y], true);
	});
});

function save_data(){
	console.log("saving!");
	var data = {};
	Object.keys(MINARDO.racetrack.blobs).forEach(function(blob){
		data[blob] = MINARDO.racetrack.blobs[blob].pos;
	});
	socket.emit("minardo_save", data);
}

function load_data(){
	console.log("loading data...");
	socket.emit("minardo_load");
}

var master_id = 0;

MINARDO.racetrack = {
	"blobs": {},
	"getNodesOf": function(d_id){
		
		var nodes = [];
		Object.keys(MINARDO.racetrack.blobs).forEach(function(key){
			if(MINARDO.racetrack.blobs[key].d_id == d_id) {
				nodes.push(MINARDO.racetrack.blobs[key]);
			}
		});
		if(nodes.length > 1){
			alert("lol");
		}
		return nodes;
	},
	"speed": 1,
	"init": function (svg, x, y, width, height){
		d3.select("#vis")
			.append("svg:defs")
			.append("svg:marker")
				.attr("id", "arrowhead")
				.attr("orient", "auto")
				.attr("markerWidth", 20)
				.attr("markerHeight", 40)
				.attr("refX", -50)
				.attr("refY", 20)
			.append("path")
				.attr("d", "M0,0 V40 L20,20 Z")
				.attr("fill", "red");
		
		MINARDO.racetrack.width = width;
		MINARDO.racetrack.height = height;

		// initilise the race track.
		// find out our size
		var racetrack = svg.append("svg:g")
			.attr("id", "racetrack")
			.attr("transform", "matrix(1 0 0 1 "+x+" "+y+")")
			.attr("x", x)
			.attr("y", y);
		MINARDO.racetrack.vis = racetrack;

		// draw the background
		// this will be a simple image which is always the same?
		// current features: nucleus, cytoplasm, membrase (heatmap).
		// future features: lipid droplets, mitochondria, golgi apparatus, ribosomes.
		// other organelles and doodads?
		var backdrop = MINARDO.racetrack.createBackdrop();
		var background = backdrop.background;

		this.sectors = this.buildSectors();

		// divide our size into those time points
		// get the list of phosphosites
		// place the phosphosites in the boxes

//		get kinases...
		var kinases = [];
		var kinase_set = {};
		Object.keys(kinase_data).forEach(function(key){
			Object.keys(kinase_data[key].phosphosites).forEach(function(phosphosite){
				kinase_set[phosphosite] = 1;
			});
			Object.keys(kinase_data[key].substrates).forEach(function(substrate){
				kinase_set[substrate] = 1;
			});
		});
		Object.keys(kinase_set).forEach(function(kinase){
			kinases.push(kinase);
		});

		positions = [];
		for(var i = 0; i < MINARDO.data.numberOfTimePoints*2; i++) {
			positions[i] = [];
		}

		kinases.forEach(function (kinase){
			if(typeof MINARDO.data.include[kinase] != 'undefined') {
				var dat = MINARDO.data.getFirstActivation(kinase);
				var place = dat.position * 2;
				if (dat.before_or_after == 'after'){
					place++;
				}
				positions[place].push(kinase);
			}
		});

// woo, got the positions
		this.positions = positions;
		racetrack = d3.select("#racetrack").datum(positions);
//		console.log(positions);
//now place them in the boxes...

		var foo = 4;
		var boxes = null;
		var spawnPoint = -80;
		racetrack.append("svg:g").attr("id","links");

		// we're going to start drawing the points now.
		// 
//		console.log(racetrack.datum());
		racetrack.datum().forEach(function(d,i){
			boxes = racetrack.append("svg:g")
				.datum(d)
				.attr("id", "box_"+i)
				.classed("box", true)
				.each(function(d){
					d.forEach(function(id){
						var blob =  {
													"d_id": id,
													"a_id": master_id, // arbitrary id
													"pos": MINARDO.racetrack.getGoodPos(d, Math.floor(i/2)),
													"d": d
											  }
						MINARDO.racetrack.blobs[master_id] = blob;
						var node = boxes.append("svg:g")
							.attr("id", "anode_"+master_id++)
							.classed("dnode_"+id, true)
							.classed("node", true)
							.attr("transform", "matrix(1 0 0 1 "+blob.pos.x+" "+blob.pos.y+")");
						node.datum(blob);
						blob.node = node;
						node.append("svg:circle")
							.classed("node_circle", true)
							.attr("fill", 'rgba(#111,0.5)')
							.attr("r", 7.5)
							.attr("cx", spawnPoint)
							.attr("cy", foo + 5)
						.transition().duration(0)
						.transition().duration((0 * (Math.floor(i/2))) / MINARDO.racetrack.speed)
						.transition().duration(1 / MINARDO.racetrack.speed)
							.attr("cx", 0)
							.attr("cy", 0)
						.each("end", function(d,i){

							//draw labels
							MINARDO.racetrack.drawLabel(blob);

							//draw lines
							console.log("drawing lines");
							MINARDO.racetrack.drawLines(blob);
						})
						foo+=12.5;
					});
				});
		});
		d3.select("#racetrack").insert("svg:g", "#links").attr("id","tracks_group");
		MINARDO.climax.init();
		MINARDO.racetrack.hoverBox.init();
	},
	"buildCommentBox": function(){
//		console.log('building comment box');
//		"buildButton": function (callback, text, w, h, x, y, class_value, group, rectId){
		var box = null;
//		d3.select("#vis").append("svg:g").classed("commentBox",true);
			d3.selectAll(".outline")
				.on('mouseover', function(d,i) {
//					console.log(d);
//					console.log(MINARDO.data.comments[d.id]);
					$("#commentBox").val(MINARDO.data.comments[d.id]);
				});

	},
	"links": [],
	"drawnNodes": {},
	"linkExists": function(a,b){
		var linkFound = false;
		MINARDO.racetrack.links.forEach(function(link){
			if (link['node'] == a && link['target'] == b) {
				linkFound = true;
			} else if (link['node'] == b && link['target'] == a) {
				linkFound = true;
			}
		});
		return linkFound;
	},
	"drawLines": function(blob){
		var node = blob.d_id;

		if(typeof MINARDO.racetrack.drawnNodes[blob.a_id] == 'undefined'){
			MINARDO.racetrack.drawnNodes[blob.a_id] = true;

			// find all the spectra from same uniprot
			var spectraPairings = MINARDO.racetrack.makeConnections(MINARDO.data.getAllSpectra(node));
			// find all the spectra that target this point
			var kinasePairings = MINARDO.racetrack.makeConnections(MINARDO.data.getTargetingSpectraOf(node));
			// find all the spectra that this point targets
			var substratePairings = MINARDO.racetrack.makeConnections(MINARDO.data.getSubstrateSpectraOf(node));
			
			
			

			Object.keys(spectraPairings).forEach(function(key){
				MINARDO.racetrack.buildLink(spectraPairings[key], blob, "spectraLink");
			});
			Object.keys(kinasePairings).forEach(function(key){
				MINARDO.racetrack.buildLink(kinasePairings[key], blob, "kinaseLink");
			});
			Object.keys(substratePairings).forEach(function(key){
				MINARDO.racetrack.buildLink(substratePairings[key], blob, "substrateLink");
			});
		}
	},
	"makeConnections": function (pairings){
		var pairs = {};
		var connections = {};
		pairings.forEach(function(pair){
			pairs[pair] = true;
			var nodes = MINARDO.racetrack.getNodesOf(pair);
			nodes.forEach(function(node){
				connections[node.a_id] = node;
			});
		});
		return connections
	},
	"bothExist": function(kinase, substrate){
		var result = false;
			if (typeof MINARDO.racetrack.drawnNodes[kinase.a_id] != 'undefined'
					&& typeof MINARDO.racetrack.drawnNodes[substrate.a_id] != 'undefined') {
						result = true;
					}
		return result;
	},
	"buildLink": function(kinase, substrate, type){
				if (!MINARDO.racetrack.linkExists(kinase.a_id, substrate.a_id)
				&& kinase.a_id != substrate.a_id
				&& this.bothExist(kinase, substrate)){
				
				var link = {
					"kinase": kinase.a_id,
					"substrate": substrate.a_id
				}
				
				var start = kinase.pos,
						end = {
					'x': substrate.pos.x - start.x,
					'y': substrate.pos.y - start.y
				}
				
				link.line = d3.select("#links")
					.append("svg:path")
					.attr("d", "M "+start.x+","+start.y+" L "+end.x+","+end.y)
					.classed("link", true)
					.classed(type, true);
				if (type != "spectraLink") {
					link.line.attr("marker-start", "url(#arrowhead)");
				}
				link.start = start;
				link.end = end;
				
				// Do we want to double link these things?
				// i.e. append to coming and going of both...
				// I guess it's good for housekeeping?


					if(typeof kinase.links == 'undefined') {
						kinase.links = {'coming':[],
													'going':[link]
													}
					} else {
						kinase.links.going.push(link);
					}

					if(typeof substrate.links == 'undefined') {
						substrate.links = {'coming':[link],
													'going':[]
													}
					} else {
						substrate.links.coming.push(link);
					}


					MINARDO.racetrack.links.push(link);
				}
	},
	"sectorSizes": [],
	"buildSectors": function(){
		var sectors = {};
		var nSectors = MINARDO.data.numberOfTimePoints;
		var nPoints = MINARDO.data.numberOfRows;
		var sSize = MINARDO.data.getSizeOfTimePoints(); // sector sizes
		sPercent = {};

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
				sectorDetails[area]['y'] = MINARDO.racetrack.height*.1;
				sectorDetails[area]['w'] = sectorArea/h2;
				sectorDetails[area]['h'] = h2;
			} else if (area == 1) {
				sectorDetails[area]['cx'] = MINARDO.racetrack.width - (MINARDO.racetrack.height /2);
				sectorDetails[area]['cy'] = MINARDO.racetrack.height /2;
				sectorDetails[area]['startAngle'] = 2*a[area]/(r*r);
				sectorDetails[area]['finishAngle'] = (2*(a[area]+sectorArea))/(r*r);
				sectorDetails[area]['r'] = r;
			} else if (area == 2) {
				sectorDetails[area]['x'] = (MINARDO.racetrack.width - (MINARDO.racetrack.height /2)) - (a[area]/h2 + sectorArea/h2);
				sectorDetails[area]['y'] = MINARDO.racetrack.height/2;
				sectorDetails[area]['w'] = sectorArea/h2;
				sectorDetails[area]['h'] = h2;
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
						.attr("d", "M "+mX+","+mY+" l "+sX+","+sY+" a400,400 0 0,1 "+eX+","+eY+" z")
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
						.attr("d", "M "+c1x+","+c1y+" l "+c2x+","+c2y+" "+c3x+","+c3y+" "+c4x+","+c4y+" a400,400 0 0,1 "+c5x+","+c5y+" z")
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
						.attr("d", "M "+c1x+","+c1y+" l "+c2x+","+c2y+" "+c3x+","+c3y+" "+c4x+","+c4y+" a400,400 0 0,0 "+c5x+","+c5y+" z")
						.classed("sector", true);

				} else {
					console.log("something is wrong");
				}
			} else if (pieces == 3) {
				// this case doesn't exist yet... i should write it anyway...
				// maybe another day
			}

		g.data([s]);
		MINARDO.racetrack.sectorSizes.push(s);
		});

		return sectors;
	},
	"createBackdrop": function(){
		// The background is created based on the width and height of the vis
		// There is no other information needed to generate the background
		// It is always the same?
				// Perhaps it could be different if we need more space in the cytoplasm or nucleus
	var r = d3.select("#racetrack");
//	console.log(this);

// draw the nucleus, membrane and cytoplasm
// set aside an area for the heatmap?

// three areas...


	var	background = r.append("svg:g")
			.attr("id", "background");
	background.append("svg:rect")
		.attr("fill", "rgba(100,100,100,.5)")
		.attr("width", this.width)
		.attr("height", this.height);



	var area_1 = r.append("svg:g")
		.attr("id", "area_1")
		.classed("area", true);
	var area_0 = r.append("svg:g")
		.attr("id", "area_0")
		.classed("area", true)
		.attr("transform", "matrix(1 0 0 -1 0 "+(this.height/2)+")");
	var area_2 = r.append("svg:g")
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
				dim.h = this.height / 2;
				dim.w = this.width - dim.h;
			} else if (area_number == 1){
				dim.h = this.height / 2;
				dim.w = this.height / 2;
				dim.x = this.width - dim.w;
				dim.y = dim.w;
			} else if (area_number == 2){
				dim.x = 0;
				dim.h = this.height / 2;
				dim.y = dim.h;
				dim.w = this.width - dim.h;
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
		"width": this.width,
		"height": this.height
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
	"sectors":{},
	"sectorTracker":{},
	"getGoodPos": function (id, sector){
		var pos = {x: Math.random() * MINARDO.racetrack.width,
							 y: Math.random() * MINARDO.racetrack.height};

		if(typeof MINARDO.racetrack.sectorTracker[id] == 'undefined'){
			MINARDO.racetrack.sectorTracker[id] = 1;
		} else {
			MINARDO.racetrack.sectorTracker[id]++;
		}

		var d = MINARDO.racetrack.getDiagonal(sector);
		if (d == null) {
			pos = MINARDO.racetrack.getRandomPos(id, sector);
		} else {
			if(d.t.x > d.b.x) {
				pos.x = MINARDO.racetrack.sectorTracker[id]*(d.t.x - d.b.x)/(id.length+1) + d.b.x;
				pos.y = MINARDO.racetrack.sectorTracker[id]*(d.t.y - d.b.y)/(id.length+1) + d.b.y;
			} else {
				pos.x = MINARDO.racetrack.sectorTracker[id]*(d.b.x - d.t.x)/(id.length+1) + d.t.x;
				pos.y = MINARDO.racetrack.sectorTracker[id]*(d.b.y - d.t.y)/(id.length+1) + d.t.y;
			}
		}

		return pos;
	},
	"getDiagonal": function (sector){
		var b = .95,
				c = 15,
				d = {
							"t":{ // top
								"x": 0,
								"y": 0
							},
							"b":{ // bottom
								"x": 0,
								"y": 0,
							}
						};
		var dat = d3.select("#sector-"+sector).data()[0];
		if (dat[1]){
//			console.log('oh shit');
//			console.log(dat);
//			console.log();



			if(dat[0] && dat[2]){
				console.log("this is going to suck. In fact, a diagonal might not be enough");
				d = null;
			} else if (dat[0]){
				var angle = dat[1].finishAngle / Math.PI;
				var degrees = angle * 180;
				var distance = dat[1].r * Math.sin(dat[1].finishAngle);
//				console.log(distance);
				if (angle < .5) {
					d.t.x = dat[0].x;
					d.t.y = dat[0].y;
					d.b.x = dat[1].cx + (distance * 2 * angle);
					d.b.y = dat[0].y + (dat[0].h * 2 * angle);
				} else if (angle < .75) {
					console.log("this is going to suck. In fact, a diagonal might not be enough");
					d = null;
				} else {
					console.log("this is going to suck. In fact, a diagonal might not be enough");
					d = null;
				}
			} else if (dat[2]){
				var angle = 1 - (dat[1].startAngle / Math.PI);
				var degrees = angle * 180;
				var distance = dat[1].r * Math.sin(dat[1].finishAngle);
					d.t.x = dat[1].cx + (distance * 2 * angle);
					d.t.y = dat[2].y + (dat[2].h * 2 * angle);
					d.b.x = dat[2].x;
					d.b.y = dat[2].y + dat[2].h;
//					console.log(angle);
			} else {
				d.t.x = dat[1].cx + (dat[1].r * Math.sin(dat[1].startAngle));
				d.t.y = (dat[1].r * Math.cos(dat[1].startAngle));
				d.b.x = dat[1].cx + (dat[1].r * Math.sin(dat[1].finishAngle));

				var newAngle = Math.PI - dat[1].finishAngle;
				
				
				d.b.y = dat[1].cy + (dat[1].r * Math.cos(newAngle));
//				console.log(d);
//				console.log(dat);
			}
		} else if (dat[0]){
			var s = dat[0]; // s stands for Square
			d.t.x = s.x + s.w;
			d.t.y = s.y;
			d.b.x = s.x;
			d.b.y = s.y + s.h;
		} else if (dat[2]){
			var s = dat[2]; // s stands for Square
			d.t.x = s.x;
			d.t.y = s.y;
			d.b.x = s.x + s.w;
			d.b.y = s.y + s.h;
		}
		
		
		return d;
	},
	"getRandomPos": function (id, sector){ //this function recursively returns a random pos
		var pos = {x: Math.random() * MINARDO.racetrack.width,
							 y: Math.random() * MINARDO.racetrack.height};
		if (MINARDO.racetrack.validPos(pos, sector)) {
			return pos;
		} else {
			return MINARDO.racetrack.getRandomPos(id, sector);
		}
	},
	"validPos": function(pos, sector){
		var b = .95,
				c = 15;
		var dat = d3.select("#sector-"+sector).data()[0];
		if (dat[0]){
			if (pos.x > dat[0].x + c &&
					pos.x + c < dat[0].x + dat[0].w &&
					pos.y > dat[0].y + c &&
					pos.y + c< dat[0].y + dat[0].h) {
				return true;
			}
		};
		if (dat[1]) {
			var x = pos.x - dat[1].cx;
			var y = pos.y - dat[1].cy;
			var radius = Math.sqrt(x * x + y * y);
			if (radius > (dat[1].r * (1 - b)) && radius < dat[1].r * b){
				if (x > 0) {
					var angle = Math.atan2(y,x) + Math.PI/2;
					if (angle > dat[1].startAngle + .06 &&
							angle + .06 < dat[1].finishAngle){
								return true;
					}
				}
			}
		}
		if (dat[2]) {
			if (pos.x > dat[2].x + c &&
					pos.x + c < dat[2].x + dat[2].w &&
					pos.y > dat[2].y + c &&
					pos.y + c < dat[2].y + dat[2].h) {
				return true;
			}
		};
		
		
d3.selectAll(".sectorGroup").on("click", function(d,i){
	var pos = d3.mouse(this);
	var x = pos[0] - 900,
			y = pos[1] - 500;

			var angle = Math.atan2(y,x) + Math.PI/2;

	console.log(angle);
	
});

		return false;
	},
	"randx": function (box_number){
		var timepoints = parseInt(MINARDO.data.numberOfTimePoints);
		var boxWidth = MINARDO.racetrack.width / timepoints;
		if (box_number < timepoints) {
			return (box_number * boxWidth) + (boxWidth * Math.random());
		} else {
			return (18 - box_number) * boxWidth - (boxWidth * Math.random());
		}
	},
	"randy": function (box_number){
		var timepoints = parseInt(MINARDO.data.numberOfTimePoints);
		var boxHeight = MINARDO.racetrack.height / 2;
		if (box_number < timepoints) {
			return boxHeight * Math.random() * .9;
		} else {
			return boxHeight + boxHeight * Math.random() * .9;
		}
	},
	"drawLabel": function (blob){
//		console.log(blob);

		var w = MINARDO.racetrack.hoverBox.w,
				h = MINARDO.racetrack.hoverBox.h;
		
		var node = d3.select(".dnode_"+blob.d_id),
				name = MINARDO.data.getName(blob.d_id),
				pSite = MINARDO.data.getResidue(blob.d_id);

		node.append("rect")
			.attr("x", 0 - (w/2))
			.attr("y", 0 - (h/2))
			.attr("width", w)
			.attr("height", h)
			.attr("fill", "white")
			.attr("stroke", "black")
			.data([blob.pos]);


		node.append("text")
			.text(name)
			.attr("x", 0 - (w/2) + 2)
			.attr("y", 0 - (h/2) + 11)
			.attr("id", "blah_"+blob.d_id);

		node.append("text")
			.text(pSite)
			.attr("x", 0 - (w/2) + 3)
			.attr("y", 0 - (h/2) + 27)
	},

// add a button for edit
// add a button for comments
		"track_count":0,
		"draw_tracks": function(){
			// find out which things should be tracks.
			var kinases = MINARDO.data.getMostActiveKinases(),
					nodes = {},
					places = {};
			kinases.forEach(function(kinase){
				nodes[kinase] = MINARDO.racetrack.getConnectionsOf(kinase);
				places[kinase] = MINARDO.racetrack.getPlacesOf(Object.keys(nodes[kinase]));
			});
			// remove their nodes.
			// remove their links.
			var kinase = kinases[MINARDO.racetrack.track_count++];
			MINARDO.racetrack.makeTrack(kinase, places[kinase]);
		},
		"makeTrack": function(kinase, places){
			var distance = 20 + (30 * MINARDO.racetrack.track_count);
			MINARDO.racetrack.draw_track(
				d3.select("#tracks_group"),
				distance,
				MINARDO.racetrack.getLimits(kinase, places)
			);
			Object.keys(kinase_data[kinase].phosphosites).forEach(function(phosphosite){
				MINARDO.racetrack.hidePhosphosite(phosphosite, distance);
			});
		},
		"hidePhosphosite": function(id, distance){
			var node = d3.selectAll(".dnode_"+id);
//			console.log(node[0]);
			if(node[0].length == 1) {
				var blob = d3.select(node[0][0]).data()[0];
				d3.select("#anode_"+blob.a_id).attr("display", "none");
//				console.log(blob);

				blob.links.coming.forEach(function(link){
					console.log(link);
					
				
					link.line.attr("display", "none");
				});




				blob.links.going.forEach(function(link){
					link.line.attr("display", "none");
				});
//				var blob = node[0][0].datum();
//				console.log(blob);
			}
		},
		"getPlacesOf": function(nodes){
			var places = {};
			nodes.forEach(function(node){
				var blob = d3.select("#anode_"+node).datum(),
						type = null,
						value = null,
						id = blob.d_id,
						place = MINARDO.data.getPlaceOf(id),
						dat = MINARDO.racetrack.sectorSizes[Math.floor(place)]
						dec = place % 1;

				//calculate the blob's type and value, and push it into place..

						if(typeof dat[1] != 'undefined'){
							// cheating here... going to do it the easy way for now.
							// fix it later?
							type = 1;
							
							
							var gap = (dat[1].finishAngle - dat[1].startAngle) * dec;
							value = gap + dat[1].startAngle;

						} else if (typeof dat[0] != 'undefined'){
							type = 0;
							value = dat[0].x + (dat[0].w * dec);
						} else if (typeof dat[2] != 'undefined'){
							type = 2;
							value = dat[2].x + (dat[2].w * (1 - dec));
						}


				places[node] = {
												 'type': type,
												 'value': value
											 }
			});
			return places;
		},
		"getConnectionsOf": function(kinase){
			var places = {},
					checkedSites = {},
					sites = Object.keys(kinase_data[kinase].phosphosites).concat(
									Object.keys(kinase_data[kinase].substrates));

			sites.forEach(function(site){
				if(typeof checkedSites[site] == 'undefined'){
					checkedSites[site] = true;
					var nodes = d3.selectAll(".dnode_"+site);
					if(nodes[0].length == 1) {
						var blob = nodes.data()[0];
						if(typeof blob.links != 'undefined') {
							blob.links.coming.forEach(function(link){ //kinase coming
								places[link.kinase] = true;						
							});
							blob.links.going.forEach(function(link){
								places[link.substrate] = true;
							});
						}
					}
				}
			});



/*
				p.forEach(function (site){
					var nodes = d3.selectAll(".dnode_"+site);
					if(nodes[0].length == 1) {
						var blob = nodes.data()[0];
						console.log(blob);
						blob.links.coming.forEach(function(link){
							d3.select(link.line[0][0]).attr("display", "none");//.remove();
						});
						blob.links.going.forEach(function(link){
							d3.select(link.line[0][0]).attr("display", "none");//.remove();
						});
						d3.select("#anode_"+blob.a_id).attr("display", "none");//.remove();
*/
			
			
			return places;
		},
		"listOfTracks": {},
		"getLimits": function(kinase, places){
			var first = {
				"type": Number.MAX_SAFE_INTEGER,
				"value": Number.MAX_SAFE_INTEGER
			},
			last = {
				"type": Number.MIN_SAFE_INTEGER,
				"value": Number.MIN_SAFE_INTEGER
			};
			Object.keys(places).forEach(function(key){
				var place = places[key];
				//console.log(place);
				if (place.type < first.type) {
						first.type = place.type;
						first.value = place.value;
				} else if (place.type == first.type) {
					if (place.value < first.value) {
						first.type = place.type;
						first.value = place.value;
					}
				}
				if (place.type > last.type) {
						last.type = place.type;
						last.value = place.value;
				} else if (place.type == last.type) {
					if (place.value > last.value) {
						last.type = place.type;
						last.value = place.value;
					}
				}
			});
			return {"kinase": kinase, "first": first, "last": last};
		},
		"draw_track": function(tracks, r, limit){
			console.log(limit);
			var a = 500 - r,
					b = 2 * r,
					c = r + 500;

			var track = tracks.append("svg:g").classed("track", true).attr("id", "track_01");
			var path = track.append("svg:path")
				.classed("link", true)
				.classed("track", true);




			if (limit.first.type == 0){
				if (limit.last.type == 0){
//					console.log("woo");
					path.attr("d", "M "+limit.first.value+" "+a+" L "+limit.last.value+" "+a);




				} else if (limit.last.type == 1){
				} else if (limit.last.type == 2){
					path.attr("d",  "M "+limit.first.value+" "+a+" L 900 "+a+
										"a 1 1 0 0 1 0 "+b+
									  "L "+limit.last.value+" "+c
										);
				} else {
					console.log("error");
				}
			} else if (limit.first.type == 1){
			} else if (limit.first.type == 2){
				if (limit.last.type == 2){
					path.attr("d", "M "+limit.first.value+" "+c+" L "+limit.last.value+" "+c);
				} else {
					console.log("error");
				}
			} else {
				console.log(limit);
				console.log("error");
			}

/*
				.attr("d",  "M "+start+" "+a+" L 900 "+a+
										"a 1 1 0 0 1 0 "+b+
									  "L "+end+" "+c
										);*/
		},
	"hoverBox": {
		"showcomments": true,
		"editableText": false,
		"movableBoxes": false,
		"w": 70,
		"h": 30,
		"init": function() {
			var that = MINARDO.racetrack.hoverBox;

			var racetrack = d3.select("#racetrack");

			var drag = d3.behavior.drag()
				.on("dragstart", MINARDO.racetrack.hoverBox.getBox)
				.on("drag", MINARDO.racetrack.hoverBox.moveBox)
				.on("dragend", MINARDO.racetrack.hoverBox.releaseBox);
			
			d3.selectAll(".node")
				.on("mouseover", this.mouseover)
				.on("mousedown", MINARDO.racetrack.hoverBox.click)
				.call(drag);

			var hBox = racetrack
				.append("svg:g")
				.attr("id", "hoverBox")
				.attr("display", "none")
			
			hBox.append("svg:rect")
				.attr("id", "hbRect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 200)
				.attr("height", 100)
				.attr("fill", "white")
				.attr("stroke", "black");

			hBox.append("text")
				.text("blahblah")
				.attr("x", 2)
				.attr("y", 12)
				.attr("id", "hbText");

			var racetrack = d3.select("#racetrack");

			racetrack
				.insert("svg:rect", "#box_0")
				.attr("id", "mouseoutLayer")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 1400)
				.attr("height", 1000)
				.attr("fill", "rgba(0,0,0,0)")
				.on("mouseover", MINARDO.racetrack.hoverBox.mouseout);
			
			var callback = function(){
				console.log("button!!!");
				alert("this button can be clicked... but doesn't do anything yet");
			};
			var button_group = racetrack.insert("svg:g", "#box_0").attr("id", "buttons");
			that.drawButton(button_group, "edit",  20, 20, 100, 50, "button 1", MINARDO.racetrack.hoverBox.toggleEditText);
			that.drawButton(button_group, "move", 130, 20, 100, 50, "button 1", MINARDO.racetrack.hoverBox.toggleMoveBoxes);
			that.drawButton(button_group, "draw tracks", 240, 20, 100, 50, "button 1", MINARDO.racetrack.draw_tracks);
			that.drawButton(button_group, "load", 350, 20, 100, 50, "button 1", load_data);
			that.drawButton(button_group, "save", 460, 20, 100, 50, "button 1", save_data);

			var status = GetURLParameter("status");

			if (status == "edit") {
				MINARDO.racetrack.hoverBox.editableText = true;
				d3.select("#edit_text").html("edit - true");
				d3.select("#move_text").html("move - false");
			} else if (status == "move") {
				MINARDO.racetrack.hoverBox.movableBoxes = true;
				d3.select("#edit_text").html("edit - false");
				d3.select("#move_text").html("move - true");
			}
			if (GetURLParameter("load") == "yes") {
				load_data();
			}
			if (GetURLParameter("draw") == "tracks") {
				MINARDO.delay().racetrack.draw_tracks();
			}

			hBox.on("click", MINARDO.racetrack.hoverBox.click);
		},
		"drawButton": function(thing, id, x, y, w, h, text, callback){
			var group = thing.append("svg:g");
				
				
			group.append("svg:rect")
				.attr("id", id)
				.attr("x", x)
				.attr("y", y)
				.attr("width", w)
				.attr("height", h)
				.attr("fill", "white")
				.attr("stroke", "black")
				.on("click", callback);
				
			group.append("svg:text")
				.text(id)
				.attr("x", x+2)
				.attr("y", y+12)
				.attr("id", id+"_text");
		},
		"toggleMoveBoxes": function(d){
			if (MINARDO.racetrack.hoverBox.movableBoxes) {
				d3.select("#move_text").html("move - false");
				MINARDO.racetrack.hoverBox.movableBoxes = false;
			} else {
				d3.select("#move_text").html("move - true");
				MINARDO.racetrack.hoverBox.movableBoxes = true;
				
				d3.select("#edit_text").html("edit - false");
				MINARDO.racetrack.hoverBox.editableText = false;
			}
		},
		"toggleEditText": function(d){
			if (MINARDO.racetrack.hoverBox.editableText) {
				d3.select("#edit_text").html("edit - false");
				MINARDO.racetrack.hoverBox.editableText = false;
			} else {
				d3.select("#edit_text").html("edit - true");
				MINARDO.racetrack.hoverBox.editableText = true;
				
				d3.select("#move_text").html("move - false");
				MINARDO.racetrack.hoverBox.movableBoxes = false;
			}
		},
		"click": function(d){
			if(MINARDO.racetrack.hoverBox.editableText){
				MINARDO.racetrack.hoverBox.editText(d);
			} else if(MINARDO.racetrack.hoverBox.movableBoxes) {
				//MINARDO.racetrack.hoverBox.moveBox(d);
			} else {
				console.log(MINARDO.racetrack.hoverBox.currentTarget);
				var uniprot = MINARDO.data.getUniprot(MINARDO.racetrack.hoverBox.currentTarget.d_id);
				var win = window.open("http://www.uniprot.org/uniprot/"+uniprot);
			}
		},
		"editText": function(d){
			// fetch the DOM element where the click event occurred
			var textElement = d3.select("#hbText");
			// fetch current text contents and place them in a prompt dialog
			var editedText = prompt("Edit textual contents:", textElement.html());
			// only replace text if user didn't press cancel
			if(editedText != null){
				MINARDO.data.comments[MINARDO.racetrack.hoverBox.currentTarget.d_id] = editedText;
				textElement.text(editedText);
			}
		},
		"enableBoxMove": function(d){
		},
		"dragTarget": null,
		"getBox": function(d){
			this.dragTarget = MINARDO.racetrack.hoverBox.currentTarget;
		},
		"releaseBox": function(d){
			this.dragTarget = null;
		},
		"moveBox": function(d){
			if (MINARDO.racetrack.hoverBox.movableBoxes){
//			this.parentNode.appendChild(this);
//				console.log("dragging");

				e = d3.event;
				m = d3.mouse(racetrack);
				MINARDO.racetrack.hoverBox.updateNode(this.dragTarget, m);
			}
		},
		"updateNode": function(blob, m, transition){
				var node = d3.select("#anode_"+blob.a_id)
					pos = {
									"x": m[0],
									"y": m[1]
								};
			if (transition) {
				node.transition().attr("transform","matrix(1 0 0 1 "+m[0]+" "+m[1]+")");
			} else {
				node.attr("transform","matrix(1 0 0 1 "+m[0]+" "+m[1]+")");
			}
			//get links to the node.
			//update them.
			blob.pos = pos;
			if (blob.links) {
				blob.links.going.forEach(function(link){
					var target = MINARDO.racetrack.blobs[link.substrate];
					link.start = {
							'x': m[0],
							'y': m[1]
							}
					link.end = {
							'x': target.pos.x - m[0],
							'y': target.pos.y - m[1]
							}
					if (transition) {
						link.line.transition().attr("d", "M "+link.start.x+","+link.start.y+" l "+link.end.x+","+link.end.y+" z");
					} else {
						link.line.attr("d", "M "+link.start.x+","+link.start.y+" l "+link.end.x+","+link.end.y+" z");
					}
				});

				blob.links.coming.forEach(function(link){
					var node = MINARDO.racetrack.blobs[link.kinase];
					var target = MINARDO.racetrack.blobs[link.substrate];

					link.end = {
							'x': m[0] - node.pos.x,
							'y': m[1] - node.pos.y
							}
if (transition) {
						link.line.transition().attr("d", "M "+link.start.x+","+link.start.y+" l "+link.end.x+","+link.end.y+" z");
					} else {
						link.line.attr("d", "M "+link.start.x+","+link.start.y+" l "+link.end.x+","+link.end.y+" z");
					}
				});
			}

			d3.select("#hoverBox").attr("transform","matrix(1 0 0 1 "+
					(m[0]-MINARDO.racetrack.hoverBox.w/2+5)+" "+
					(m[1]+MINARDO.racetrack.hoverBox.h/2)+")");
		},
		
		"mouseover": function(){
			if(MINARDO.racetrack.hoverBox.showcomments) {
				var blob = MINARDO.racetrack.blobs[$(this).attr("id").slice(6)],
						id = blob.d_id,
						x = blob.pos.x,
						y = blob.pos.y,
						w = MINARDO.racetrack.hoverBox.w,
						h = MINARDO.racetrack.hoverBox.h,
						newX = x - w/2 + 5,
						newY = y + h/2;

				var hBox = d3.select("#hoverBox");

				hBox.attr("display", "")
					.attr("transform","matrix(1 0 0 1 "+newX+" "+newY+")");

				d3.select("#hbText").text(MINARDO.data.comments[id]);

				MINARDO.racetrack.hoverBox.currentTarget = blob;
				
				d3.select("#heatBox").remove();
				var heatBox = hBox.append("svg:g").attr("id", "heatBox");
				
				//get the data.
				var sites = MINARDO.data.getAllSpectra(id),
						height = (h - 20) / sites.length,
						width = w / MINARDO.data.numberOfTimePoints;

				heatBox.selectAll(".row")
						.data(sites)
							.enter().append("g")
							.classed("row", true)
							.attr("id", function(d){return "row_"+d;})
							.attr("transform",function(d,i){
					var y = (i * MINARDO.heatmap.rHeight);
					return MINARDO.helper.matrix(0,y,1);
				})
				.datum(function (d, i) {
					return data = {
								"id": d,
								"timeCourse": MINARDO.data.getTimeCourse(d)
							};
				})
				.each(function (d, i){
					var thing = d3.select(this);
					var colour_scale = MINARDO.heatmap.colourScale.getColourScale(thing.datum().id);

					//draw the rects
					thing.selectAll(".rect")
							.data(d.timeCourse)
						.enter().append("svg:rect")
							.classed("rect", true)
							.attr("width", MINARDO.heatmap.rWidth)
							.attr("height", MINARDO.heatmap.rHeight)
							.attr('x', function (d, i){return (i * MINARDO.heatmap.rWidth);})
							.attr('y', 70)
							.style('fill',function(d) {
								return colour_scale(d);
							});
				});




				sites.forEach(function(site){
					var data = MINARDO.data.getTimeCourse(site);
				})



			}
		},
		"mouseout": function(){
			MINARDO.racetrack.hoverBox.currentTarget = {};
			console.log("mouseout detected");
			d3.select("#hoverBox").attr("display", "none");
		},
		"currentTarget": {}
	}






}

MINARDO.climax = {
	"init": function(){
		var vis = d3.select("#racetrack");
		this.buildSegments();
		// draw segments.
		// highlight segments based on where they are.
		// place arrows.
	},
		"buildSegments": function(){
		
		//find out the number of sectors		
		//get start and stop positions for each of the sectors
		//draw them....

		var sectors = MINARDO.racetrack.sectors;
		

		
		
		var sectors = {};
		var nSectors = MINARDO.data.numberOfTimePoints;
		var nPoints = MINARDO.data.numberOfRows;
		var sSize = MINARDO.data.getSizeOfTimePoints(); // sector sizes

		sPercent = {}; // sector percentage

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
				sectorDetails[area]['y'] = MINARDO.racetrack.height*.1;
				sectorDetails[area]['w'] = sectorArea/h2;
				sectorDetails[area]['h'] = h2;
			} else if (area == 1) {
				sectorDetails[area]['cx'] = MINARDO.racetrack.width - (MINARDO.racetrack.height /2);
				sectorDetails[area]['cy'] = MINARDO.racetrack.height /2;
				sectorDetails[area]['startAngle'] = 2*a[area]/(r*r);
				sectorDetails[area]['finishAngle'] = (2*(a[area]+sectorArea))/(r*r);
				sectorDetails[area]['r'] = r;
			} else if (area == 2) {
				sectorDetails[area]['x'] = (MINARDO.racetrack.width - (MINARDO.racetrack.height /2)) - (a[area]/h2 + sectorArea/h2);
				sectorDetails[area]['y'] = MINARDO.racetrack.height/2;
				sectorDetails[area]['w'] = sectorArea/h2;
				sectorDetails[area]['h'] = h2;
			}

			a[area] += sectorArea;
			return sectorDetails;
		};

		//draw sectors...
		var sg = d3.select("#racetrack").append("svg:g").attr("id", "sectors");
		
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
console.log(mX,mY);
console.log(sX,sY);
console.log(eX,eY);
					g.append("svg:path")
						.attr("d", "M "+mX+","+mY+" l "+sX+","+sY+" a400,400 0 0,1 "+eX+","+eY+" z")
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
						.attr("d", "M "+c1x+","+c1y+" l "+c2x+","+c2y+" "+c3x+","+c3y+" "+c4x+","+c4y+" a400,400 0 0,1 "+c5x+","+c5y+" z")
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
						.attr("d", "M "+c1x+","+c1y+" l "+c2x+","+c2y+" "+c3x+","+c3y+" "+c4x+","+c4y+" a400,400 0 0,0 "+c5x+","+c5y+" z")
						.classed("sector", true);

				} else {
					console.log("something is wrong");
				}
			} else if (pieces == 3) {
				// this case doesn't exist yet... i should write it anyway...
				// maybe another day
			}

		g.data([s]);
		});

		return sectors;
	}
}




function openNewBackgroundTab(url){
    var a = document.createElement("a");
    a.href = url;
    var evt = document.createEvent("MouseEvents");
    //the tenth parameter of initMouseEvent sets ctrl key
    evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0,
                                true,
                        false, false, false, 0, null);
    a.dispatchEvent(evt);
}










    

    
    
    
    
    
    
    
    
    
    
    
    
    
  
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    