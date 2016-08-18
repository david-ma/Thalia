// racetrack file........

var MINARDO = MINARDO || {};

a = [0,0,0]; // global... this is bad... used for function allocateSector();

MINARDO.racetrack = {
	"speed": 1,
	"init": function (svg, x, y, width, height){
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
		console.log(positions);
//now place them in the boxes...

		var foo = 4;
		var boxes = null;
		var spawnPoint = -80;
		racetrack.append("svg:g").attr("id","links");
		racetrack.datum().forEach(function(d,i){
			boxes = racetrack.append("svg:g")
				.datum(d)
				.attr("id", "box_"+i)
				.classed("box", true)
				.each(function(d){
					d.forEach(function(id){
						var node = boxes.append("svg:g")
							.attr("id", "node_"+id)
							.classed("node",true);

//						var pos = MINARDO.racetrack.getRandomPos(d, Math.floor(i/2));

						var pos = MINARDO.racetrack.getGoodPos(d, Math.floor(i/2));
						
						node.append("svg:circle")
							.attr("fill", 'rgba(#111,0.5)')
							.attr("r", 7.5)
							.attr("cx", spawnPoint)
							.attr("cy", foo + 5)
						.transition().duration(500)
						.transition().duration((500 * (Math.floor(i/2))) / MINARDO.racetrack.speed)
						.transition().duration(1000 / MINARDO.racetrack.speed)
							.attr("cx", pos.x)
							.attr("cy", pos.y)
						.each("end", function(d,i){
							d.forEach(function(id){
								MINARDO.racetrack.drawLines(id);
							});
						});
						foo+=12.5;
					});
				});

		});
		

		// select the major kinases
		Object.keys(kinase_data).forEach(function(kinase,i,list){
			var timepoints = MINARDO.data.numberOfTimePoints;
//			console.log(list);	
		});


		// set rails

		// draw tracks for the major kinases
		// draw lines between related proteins????


		MINARDO.climax.init();
	},
	"buildCommentBox": function(){
		console.log('building comment box');
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
	"drawLines": function(node){
		if(typeof MINARDO.racetrack.drawnNodes[node] == 'undefined'){
			MINARDO.racetrack.drawnNodes[node] = true;
			
			
			//all the spectra from same uniprot
			var pairings = MINARDO.data.getAllSpectra(node);
			//all the spectra that target this point
			pairings = pairings.concat(MINARDO.data.getTargetingSpectraOf(node));
			//all the spectra that this point targets
			pairings = pairings.concat(MINARDO.data.getSubstrateSpectraOf(node));
			
			var blah = {};
			pairings.forEach(function(pair){
				blah[pair] = true;
			});
			Object.keys(blah).forEach(function(pair){
				if (!MINARDO.racetrack.linkExists(node,pair)
				&& node != pair
				&& typeof MINARDO.racetrack.drawnNodes[pair] != 'undefined'){
					var link = {
						"node": node,
						"target": pair
					};
					var s = {
						'x': $("#node_"+node+" circle").attr("cx"),
						'y': $("#node_"+node+" circle").attr("cy")
					},
					f = {
						'x': $("#node_"+pair+" circle").attr("cx") - s.x,
						'y': $("#node_"+pair+" circle").attr("cy") - s.y
					};

					d3.select("#links")
						.append("svg:path")
						.attr("d", "M "+s.x+","+s.y+" l "+f.x+","+f.y+" z")
						.classed("link",true);


					MINARDO.racetrack.links.push(link);
				}
			});





//			console.log("woo");
		}
	},
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
				console.log(distance);
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
					console.log(angle);
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
	},
	"runTrials":function(){
		console.log("running trials");
		for(var i = 0; i < 10000; i++){
			this.trial();
		}
		console.log("trials done");
	},
	"trial": function(){
		function getValidDay(days){
			var day = Math.floor(Math.random()*5);
			if (days[day].length >= 100){
				day = getValidDay(days);
			}
			return day;
		}
//	console.log('hello, running trial');
//	distribute 500 things between 5 days

	var days = [[],[],[],[],[]];
	for(var i = 0; i < 500; i++){
		var day = getValidDay(days);
		days[day].push(i);
	}
//check to see if any of the days end up with more than 40 of the top 80

	days.forEach(function(day){
		var count = 0;
		day.forEach(function(thing){
			if(thing < 100){
				count++;
			}
		});
		if(count >= 35) {
			console.log("oh shit!");
		}
	});
	}
}















    

    
    
    
    
    
    
    
    
    
    
    
    
    
  
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    