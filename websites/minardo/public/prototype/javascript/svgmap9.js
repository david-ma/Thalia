// racetrack file........

var MINARDO = MINARDO || {};

var arrowSize = 5.75; // Change the size of my arrowheads. Should this go in the "MINARDO" object?
var arrowColour = "#939598";
MINARDO.rth = { // Race Track Highlighter
	"init": function (){
		drawMajorTracks();
		drawPoints();
		drawOtherPoints();
	},
	"points": {},
	"otherPoints":{},
	"lookup": {},
	"lookupPush": function (point){
		var thing = d3.select(point);
		var target = thing.datum().targetSpectra || thing.datum().target;

		if (typeof this.lookup[target] === "undefined"){
			this.lookup[target] = [];
		}

		this.lookup[target].push(thing);

	},
	"select": function (data){
		if(data.relatedSpectra) {
			data.relatedSpectra.forEach(function (blah){
				MINARDO.hmh.drawOutlineOnId(blah);
			});
		}
	},
	"unselect": function (){ //does this even do anything?
		MINARDO.hmh.unselect();
		MINARDO.rth.unhighlight(); //not needed?
	},
	"highlightAllRelated": function (spectra){
		MINARDO.hmh.brushRelated(spectra);
		if (MINARDO.rth.lookup[spectra]){
			MINARDO.rth.lookup[spectra].forEach(function (thing){
				MINARDO.rth.highlight(thing);
			});
		}
	},
	"highlightId": function (id){
//		console.log("highlighting: "+ id);
//		console.log(id);
		if (id) {
			MINARDO.hmh.drawOutlineOnId(id); //only highlights one spectra.... we want all the related spectra to be highlighted?
		}
		if (MINARDO.rth.lookup[id]){
			MINARDO.rth.lookup[id].forEach(function (spectra){ //highlight each instance of this target
				MINARDO.rth.highlight(spectra);
//				console.log(spectra.datum().relatedSpectra);

/* don't do this.. why would you want it to do this? not sure why, but it only activates for IRS1??
				if (spectra.datum().relatedSpectra) {
					spectra.datum().relatedSpectra.forEach(function (relatedSpectraID){
						if (MINARDO.rth.lookup[relatedSpectraID]){
							MINARDO.rth.lookup[relatedSpectraID].forEach(function (relatedSpectra){
								MINARDO.rth.highlight(relatedSpectra);
							});
						}
					});
				} else {
//					console.log("no related spectra found");
				}*/
			});
		}
	},
	"highlight": function (thing){
		thing.datum().hitbox.attr("fill", MINARDO.rth.hitboxColourActivator);
		MINARDO.rth.highlighted.push(thing);
//		console.log(thing.datum().relatedSpectra);
	},
	"unhighlight": function (){
		MINARDO.hmh.unselect();
		MINARDO.rth.highlighted.forEach(function (thing){
			if (thing.classed("point")) {
				thing.datum().hitbox.attr("fill", MINARDO.rth.hitboxColourDefault);
			} else if (thing.classed("track")) {
				thing.datum().hitbox.attr("stroke", MINARDO.rth.hitboxColourDefault);
			}
		});
		MINARDO.rth.highlighted = [];
	},
	"highlighted": [],
	"highlightTrack": function (track){
//		console.log("Highlighting track : "+ track.datum().name);

		track.datum().ownSpectra.forEach(function (spectra){
			MINARDO.rth.highlightSpectra(spectra);
		});

		track.datum().targetSpectra.forEach(function (spectra){
			MINARDO.rth.highlightTargetSpectra(spectra);
		});

		MINARDO.rth.highlighted.push(track);
		track.datum().hitbox.attr("stroke", MINARDO.rth.hitboxColourActivator);
	},
	"highlightSpectra": function (spectra){
		MINARDO.hmh.highlightActivator(spectra, MINARDO.rth.hitboxColourActivator);
		if (MINARDO.rth.lookup[spectra]) {
			MINARDO.rth.lookup[spectra].forEach(function (thing){
				MINARDO.rth.highlight(thing);
			});
		}
	},
	"highlightTargetSpectra": function (spectra){
		if (MINARDO.rth.showingTargets) {
			MINARDO.hmh.highlightTarget(spectra, MINARDO.rth.hitboxColourTarget);
			if (MINARDO.rth.lookup[spectra]) {
				MINARDO.rth.lookup[spectra].forEach(function (thing){
					thing.datum().hitbox.attr("fill", MINARDO.rth.hitboxColourTarget);
					MINARDO.rth.highlighted.push(thing);
				});
			}
		}
	},
	"hitboxColourDefault": "rgba(0, 0, 0, 0)", //"rgba(255, 0, 0, 0.1)" //default
	"hitboxColourActivator": "rgba(255, 255, 0, 0.5)",
	"hitboxColourTarget": "rgba(0,255,255, 0.5)",
	"showTargets": function (){
		if(MINARDO.rth.showingTargets) {
			MINARDO.rth.showingTargets = false;
			d3.select("#show_targets_button").attr("fill", "#aaaaaa");
		} else {
			MINARDO.rth.showingTargets = true;
			d3.select("#show_targets_button").attr("fill", MINARDO.rth.hitboxColourTarget);
		}
	},
	"showingTargets": false
}
function drawRacetrack(){
	MINARDO.rth.init();
};

function drawMajorTracks(){
	var tracks = d3.select("#major_tracks").selectAll(".track")
		.data(majorTracks).enter().append("svg:g")
		.attr("id", function(d){return "track_"+d.number;})
		.classed("track", true)
		.each(function (d, i){
			var track = d3.select(this);

			// white track
			var path = track.append("svg:path")
					.attr("fill", "none")
					.attr("opacity", 0.75)
					.attr("stroke", "#FFF")
					.attr("stroke-width", 12);
			if (d.path) {
				path.attr("d", d.path);
			} else if (d.line) {
				path.attr("d","M"+d.line.x1+","+d.line.y1+"L"+d.line.x2+","+d.line.y2);
			} else {
				console.log("Error! Missing track information??");
			}
		
			// protein name
			track.append("svg:text")
				.text(d.name)
				.attr("fill", "#2B3990")
				.attr("font-family", "MyriadPro-Bold")
				.attr("font-size", 23)
				.attr("transform", "matrix("+d.matrix+")");

			// hitbox, i.e. the mouse goes over this part and it gets highlighted.
			var hitbox = track.append("svg:path")
				.attr("opacity", 0.75)
				.attr("fill", "none")
				.attr("stroke", MINARDO.rth.hitboxColourDefault)
				.attr("stroke-width", 12)
				.on("mouseenter",function (d,i){
					MINARDO.rth.highlightTrack(track);
				})
				.on("mouseout",function (d,i){
					MINARDO.rth.unhighlight();
				});
			if (d.path) {
				hitbox.attr("d", d.path);
			} else if (d.line) {
				hitbox.attr("d","M"+d.line.x1+","+d.line.y1+"L"+d.line.x2+","+d.line.y2);
			}
			d.hitbox = hitbox;
		});
}

var majorTracks = [{
	"name": "SGK1",
	"matrix": "1 0 0 1 181.2749 646.5923",
	"path": "M253.947,638.974h1353.623		c0,0,266.742-4.427,266.742,263.646c0,247.797-259.448,245.061-267.111,245.061s-723.681,0-723.681,0",
	"ownSpectra": [],
	"targetSpectra": [4497,31570,31569,32169,32167,1818,1816]
},
{
	"name": "mTORC1",
	"matrix": "0.9892 0.1468 -0.1468 0.9892 1692.1611 504.4756",
	"path": "M1658.77,502.067h4.186		c0,0,374.26-27.651,374.26,406.244c0,390.112-363.684,383.652-374.26,383.652c-10.577,0-1287.159,0-1287.159,0",
	"ownSpectra": [11851,25972,25965,8439,8448,32018,6505],
	"targetSpectra": [11851,25972,25965,8439,8448,6505,6246,21925,33202,19781,19782,13271,13269,33657,33654,13766]
},
{
	"name": "mTORC2",
	"matrix": "1 0 0 1 405.3799 452.8633",
	"path": "M507.68,447.004h1166.648		c0,0,417.342-31.611,417.342,464.413c0,445.973-405.547,438.589-417.342,438.589c-11.794,0-1192.922,0-1192.922,0",
	"ownSpectra": [32613,18051,11851,11843,25972,25965],
	"targetSpectra": [3081]
},
{
	"name": "AS160",
	"matrix": "1 0 0 1 630.5073 380.8379",
	"path": "M693.784,373.708h973.511			c17.032,0.401,53.355,2.14,83.21,8.774",
	"ownSpectra": [10128,32814,10125,10126],
	"targetSpectra": []
},
{
	"name": "Akt",
	"matrix": "1 0.0023 -0.0023 1 351.6426 244.4824",
	"path": "M391.906,237.871		c96.467,0,1093.052,0,1093.052,0s18.562,0.108,29.912,0.108c25.577,0,51.633,78.037,99.241,78.037		c341.671,0,570.026,263.975,570.026,594.492c0,569.422-565.127,604.262-580.022,604.262c-5.396,0-193.022,0-430.149,0",
	"ownSpectra": [31272,3081],
	"targetSpectra": [11441,11430,33125,32018,32814,10125,10126,7476,7477,23370,1800,26145,24474,4288,17539,8254,7591,12914,4508,32613,25879] //also ULK1 S775
},
{
	"name": "Erk1/2",
	"matrix": "1 0.0078 -0.0078 1 945.7007 547.6714",
	"path": "M804.872,1236.15h836.576		c0,0,346.365,22.808,346.365-335.089c0-63.183-12.976-113.755-33.906-154.23c-22.983-58.854-53.466-101.243-87.686-131.332l0,0c-33.829-28.569-122.1-77.269-208.414-77.269c-86.313,0-620.616,0-620.616,0",
	"ownSpectra": [37449,33117,37331,31143],
	"targetSpectra": [1212]
},
{
	"name": "Gsk",
	"matrix": "1 0 0 1 378.7681 587.9932",
	"path": "M1471.606,1186.168h133.732		c0,0,329.264,19.945,329.264-293.023c0-55.252-19.088-141.386-64.903-201.963c-40.173-53.116-130.909-109.671-230.001-109.671		s-1218.098,0-1218.098,0",
	"ownSpectra": [4288,24474],
	"targetSpectra": [5572,5575,6241]
},
{
	"name": "p70S6K",
	"matrix": "1 0.009 -0.009 1 375.5166 416.4595",
	"path": "M472.398,411.876		c0,0,1161.567,0,1267.926,0s231.012,67.622,274.131,124.632l33.963,40.786c51.274,78.626,90.963,198.022,90.963,341.6		c0,512.48-517.805,544.768-531.267,544.768c-13.461,0-1266.842,0-1266.842,0",
	"ownSpectra": [19781,19782],
	"targetSpectra": [1143,1144,8828,32553]
},
{
	"name": "PKA",
	"matrix": "1 0 0 1 1568.1924 275.8892",
	"path": "M1626.548,267.892			c167.005,0,601.561,76.815,601.561,645.133c0,456.016-345.123,587.785-528.464,625.354",
	"ownSpectra": [32877],
	"targetSpectra": [9506,10659,10665,3943]
},{
	"name": "Igf1r",
	"matrix": "0.9999 -0.0122 0.0122 0.9999 14.2524 195.231",
	"line": {
		"x1": 76.87,
		"y1": 188.166,
		"x2": 1248.559,
		"y2": 188.166
	},
	"ownSpectra": [37334,37335,37336],
	"targetSpectra": [37640,37643,37639,37636]
},{
	"name": "Irs1",
	"matrix": "0.9999 -0.0152 0.0152 0.9999 28.5005 267.8423",
	"line": {
		"x1": 68.699,
		"y1": 261.231,
		"x2": 742.061,
		"y2": 261.231
	},
	"ownSpectra": [37640,37643,37639,37636,23681],
	"targetSpectra": [] //should be hitting Grb2..... which has no spectra
}];

function drawPoints(){
	d3.select("#Gene_Names").selectAll(".point")
		.data(points).enter().append("svg:g")
		.attr("id", function(d){return "point_"+d.number;})
		.classed("point",true)
		.each(function(d, i) {
			drawCircles(this, d);
			drawArrows(this, d);
			drawSpecial(this, d);
			drawTags(this, d);
			drawProteins(this, d);
			d.hitbox = drawHitbox(this, d);
		
			MINARDO.rth.points[d.number] = this;
			MINARDO.rth.lookupPush(this);
		});
}

function drawOtherPoints(){
//	console.log("hey");
	d3.select("#Gene_Names").selectAll(".otherPoint")
		.data(other_points).enter().append("svg:g")
		.attr("id", function(d){return "otherPoint_"+d.number;})
		.classed("point",true)
		.each(function(d, i) {
			drawArrows(this, d);
			drawLines(this, d);
			drawSpecial(this, d);
			drawTags(this, d);
			drawProteins(this, d);
			drawTargetProteins(this, d);
			d.hitbox = drawHitbox(this, d);

			MINARDO.rth.otherPoints[d.number] = this;
			MINARDO.rth.lookupPush(this);
		});
}

function getHitboxCoords(thing){
	var id = $(thing).attr("id");

	var offset = $(thing).offset();
	var origin = {
		"y": (offset.top - $("#map_group").offset().top + 10) * 1.66,				//hard coded hack, no idea why this is needed
		"x": (offset.left - $("#map_group").offset().left - 10) * 1.66			//1.66 = expansion ratio
	}
	return origin;
}

function drawHitbox(thing, data){
	var id = $(thing).attr("id"),
			height = document.getElementById(id).getBBox().height,
			width = document.getElementById(id).getBBox().width,
			coords = getHitboxCoords(thing);

	var hitbox = d3.select(thing).append("svg:rect")
		.classed("hitbox", true)
		.attr("height", height)
		.attr("width", width)
		.attr("y", coords.y)
		.attr("x", coords.x)
		.attr("fill", MINARDO.rth.hitboxColourDefault) //this is just so we can see it for now, change the alpha to zero later.
		.on("mouseenter",function (d,i){
			var target = d.targetSpectra || d.target;
			MINARDO.rth.highlightAllRelated(target);
		})
		.on("mouseout",function (d,i){
			MINARDO.rth.unhighlight();
		});

	return hitbox;
}

function drawCircles(thing, data){
	var group = d3.select(thing).append("g");
	group.append("svg:circle").attr("fill", "#F1F2F2").attr("r", 13).attr("cx",data.start.x).attr("cy",data.start.y - 10);
	group.append("svg:circle").attr("fill", arrowColour).attr("r", 7.5).attr("cx",data.start.x).attr("cy",data.start.y - 10);
}

function drawArrows(thing, data){
	var group = d3.select(thing);
	if (data.end){
		//draw the line
		group.append("svg:g").append("svg:path")
			.attr("fill", "none")
			.attr("stroke", arrowColour)
			.attr("stroke-width", 2.4)
			.attr("d","M"+(data.start.x)+","+(data.start.y-10)+"L"+data.end.x+","+data.end.y);

		//draw the arrowhead
		var opp = data.start.x - data.end.x,
				adj = data.end.y - data.start.y +10,
				hyp = Math.sqrt((opp * opp) + (adj * adj));

		group
			.append("svg:g").attr("transform", "matrix("+(adj/hyp)+" "+(opp/hyp)+" "+(-opp/hyp)+" "+(adj/hyp)+" "+ (data.end.x) +" "+(data.end.y)+")")
			.append("svg:polygon")
			.attr("fill", arrowColour)
			.attr("points", "-"+arrowSize+",-"+arrowSize+" "+arrowSize+",-"+arrowSize+" 0,"+arrowSize);
		//	.attr("points", "0,0 "+2*arrowSize+",0 "+arrowSize+","+2*arrowSize);
	}
}

function drawSpecial(thing, data){
	var group = d3.select(thing);
	if (data.special){
		group.append("svg:g").append("svg:path")
			.attr("fill", "none")
			.attr("stroke", arrowColour)
			.attr("stroke-width", 2.4)
			.attr("d", data.special.line);

//<polygon fill="#939598" points="2192.489,993.473 2201.87,1000.899 2190.747,1005.311 			"></polygon>
		if (data.special.head) {
			group.append("svg:polygon")
				.attr("fill", arrowColour)
				.attr("points", data.special.head);
		}

		if (data.special.rect) {
			group.append("svg:rect")
				.attr("fill", arrowColour)
				.attr("width", 2.4)
				.attr("height", 15.6)
				.attr("x", data.special.rect.x)
				.attr("y", data.special.rect.y);
		}
	}
}

function drawTags(thing, data){
	var group = d3.select(thing);
	var matrix, type, position;

	if (data.tag){
		matrix = data.tag.matrix;
		type = data.tag.type;
		position = data.tag.position;
		drawTag(matrix, type, position, group);
	} else if (data.tags) {
		data.tags.forEach(function (tag){
		matrix = tag.matrix;
		type = tag.type;
		position = tag.position;
		drawTag(matrix, type, position, group);
		});
	} else {
		console.log("no tag?");
	}
}

function drawTag(matrix, type, position, group) {
	var tag = group.append("svg:text")
		.attr("font-size", 11.2)
		.attr("font-family", "MyriadPro-Bold")
		.attr("transform", "matrix("+matrix+")")
		.text(type+position);

	if (type == "S") {
		tag.attr("fill", "#F15A29");
	} else if (type == "T") {
		tag.attr("fill", "#39B54A");
	} else if ( type == "Y") {
		tag.attr("fill", "#27AAE1");
	} else {
		tag.attr("fill", "#F15A29");
		console.log("error!!! tag has unknown type??");
	}
}

function drawProteins(thing, data) {
	var group = d3.select(thing);
	if (data.protein){
		group.append("svg:text")
			.attr("font-size", 18)
			.attr("font-family", "MyriadPro-Semibold")
			.attr("transform", "matrix("+data.protein.matrix+")")
			.text(data.protein.name);
//<text transform="matrix(1 0 0 1 452.0952 353.5103)" font-family="'MyriadPro-Semibold'" font-size="18" class="FS-18 tag tag-Rps6">Rps6</text>
	}
}

function drawTargetProteins(thing, data) {
	var group = d3.select(thing);
	if (data.targetProtein){
		group.append("svg:text")
			.attr("font-size", 18)
			.attr("font-family", "MyriadPro-Semibold")
			.attr("transform", "matrix("+data.targetProtein.matrix+")")
			.text(data.targetProtein.name);
	}
}

function drawLines(thing, data){
	var group = d3.select(thing);
	if (data.line){
		//draw the line
		group.append("svg:g").append("svg:path")
			.attr("fill", "none")
			.attr("stroke", arrowColour)
			.attr("stroke-width", 2.4)
			.attr("d","M"+(data.line.x1)+","+(data.line.y1)+"L"+data.line.x2+","+data.line.y2);

		//draw the arrowhead
		var opp = data.line.x2 - data.line.x1,
				adj = data.line.y1 - data.line.y2,
				hyp = Math.sqrt((opp * opp) + (adj * adj));

		group
			.append("svg:g").attr("transform", "matrix("+(adj/hyp)+" "+(opp/hyp)+" "+(-opp/hyp)+" "+(adj/hyp)+" "+ (data.line.x1) +" "+(data.line.y1)+")")
			.append("svg:polygon")
			.attr("fill", arrowColour)
			.attr("points", "-"+arrowSize+",-"+arrowSize+" "+arrowSize+",-"+arrowSize+" 0,"+arrowSize);
	}
}

var other_points = [{
/*	"number": 0,
	"name": "PIP",
// PIP???


<path fill="#27AAE1" d="M17.195,237.412c-4.697,0.024-8.521-3.386-8.543-7.617L8.073,116.68c-0.021-4.23,3.768-7.679,8.464-7.704
		l7.846-0.04c4.697-0.024,8.521,3.386,8.543,7.616l0.579,113.115c0.022,4.231-3.768,7.68-8.465,7.704L17.195,237.412z"></path>
<text transform="matrix(1 0 0 1 133.73 297.3403)" fill="#D7DF23" font-family="'MyriadPro-Semibold'" font-size="18" class="FS-18 tag tag-PIP">PIP</text>
<g>
	<path fill="none" stroke="#D7DF23" stroke-width="2" stroke-miterlimit="10" d="M20.79,237.168v41.101
		c0,0,1.5,23.763,26.999,23.763s108.809,0,124.151,0s29.114-11.873,29.114-29.889s0-18.016,0-18.016v-20.028"></path>
	<g>
		<polygon fill="#D7DF23" points="206.011,235.558 201.025,226.923 196.039,235.558 			"></polygon>
	</g>
</g>

},{*/

	// PDK1 activating Akt's T308
  "special": {
    "line": "M319.312,256.083 c8.857,45.949,86.068,40.606,90.308-1.755",
    "head": "415.433,256.062 409.433,245.71 403.467,256.083"
  },
  "label": "T308",
  "number": 1,
  "tag": {
  	"type": "T",
  	"position": 308,
  	"matrix": "1 0.0061 -0.0061 1 397.7451 241.812"
  },
  "protein": {
  	"name": "PDK1",
  	"matrix": "1 0 0 1 298.2881 249.3359"
  },
  "target": 31272,
  "proteinSpectra": []
},{
  "special": {
    "line": "M95.576,440.906c0,0,0,28.707,0,44.721",
    "head": "89.625,483.878 95.608,494.24 101.592,483.878"
  },
  "label": "S497",
  "number": 2,
  "tag": {
  	"type": "S",
  	"position": 497,
  	"matrix": "1 -0.0074 0.0074 1 86.7373 508.9453"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 90.75 434.8062"
  },
  "targetProtein": {
  	"name": "Plin1",
  	"matrix": "1 0 0 1 81.8892 526.9346"
  },
  "target": 9506,
  "proteinSpectra": []
},
/*{

// insulin thing?
<text transform="matrix(1 0 0 1 24.7812 43.0264)" font-family="'MyriadPro-Semibold'" font-size="18" class="FS-18 tag tag-Insulin">Insulin</text>
<g>
		<path fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" d="M45.688,53.642
			c-1.711,10.894-1.357,8.644-3.153,20.076"></path>
		<g>
			<polygon fill="#939598" points="39.54,54.447 47.057,45.138 51.361,56.303 			"></polygon>
		</g>
		<g>
			<polygon fill="#939598" points="36.93,71.066 41.232,82.23 48.751,72.922 			"></polygon>
		</g>
	</g>



},
*/
{

  "special": {
    "line": "M417.653,168.873 c0.009-9.097,0.015-22.262-0.014-23.226",
    "head": "423.593,167.125 417.611,177.488 411.627,167.127"
  },
  "label": "Y1189",
  "number": 3,
  "tag": {
  	"type": "Y",
  	"position": 1189,
  	"matrix": "1 -0.0045 0.0045 1 402.2046 191.6396"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 413.6699 143.1953"
  },
  "target": 37335,
  "proteinSpectra": []

},{

  "special": {
    "line": "M900.482,168.873 c0.009-9.097,0.015-22.262-0.014-23.226",
    "head": "906.422,167.125 900.44,177.488 894.456,167.127"
  },
  "label": "Y1185",
  "number": 4,
  "tag": {
  	"type": "Y",
  	"position": 1185,
  	"matrix": "1 -0.0045 0.0045 1 883.4258 191.7354"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 896.499 143.1953"
  },
  "target": 37334,
  "proteinSpectra": []
},{

  "special": {
    "line": "M1181.761,168.873 c0.009-9.097,0.015-22.262-0.014-23.226",
    "head": "1187.7,167.125 1181.719,177.488 1175.734,167.127"
  },
  "label": "Y1190",
  "number": 5,
  "tag": {
  	"type": "Y",
  	"position": 1190,
  	"matrix": "1 -0.0045 0.0045 1 1161.4033 192.3857"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1177.7773 143.1953"
  },
  "target": 37336,
  "proteinSpectra": []

},{

  "line": {
  	"x1":"997.859",
  	"y1":"236.972",
  	"x2":"997.778",
  	"y2":"287.392",
  	"head": "1003.806,238.732 997.84,228.36 991.84,238.713"
  },
  "label": "Y683",
  "number": 6,
  "tag": {
  	"type": "Y",
  	"position": 683,
  	"matrix": "1 -0.0045 0.0045 1 984.8989 205.6274"
  },
  "targetProtein": {
  	"name": "Nhe1",
  	"matrix": "1 0 0 1 977.2773 219.5425"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 992.8779 305.7476"
  },
  "target": 37554,
  "proteinSpectra": []

},{

  "special": {
    "line": "M1086.903,714.792 c0.009-9.097,0.015-22.262-0.014-23.226",
    "head": "1092.842,713.044 1086.861,723.407 1080.876,713.046"
  },
  "label": "S272",
  "number": 7,
  "tag": {
  	"type": "S",
  	"position": 311,
  	"matrix": "1 -0.0074 0.0074 1 1074.4482 732.6123"
  },
  "targetProtein": {
  	"name": "Cables1",
  	"matrix": "1 0 0 1 1056.189 750.3262"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1082.9194 689.1143"
  },
  "target": 29956,
  "proteinSpectra": []
},{

  "line": {
  	"x1":"1400.155",
  	"y1":"610.145",
  	"x2":"1390.086",
  	"y2":"610.171",
  	"head": "1398.389,604.2 1408.767,610.155 1398.42,616.166"
  },
  "label": "T333",
  "number": 8,
  "tag": {
  	"type": "T",
  	"position": 333,
  	"matrix": "1 -0.0074 0.0074 1 1420.5078 608.2051"
  },
  "targetProtein": {
  	"name": "NEK9",
  	"matrix": "1 0 0 1 1412.0947 624.2227"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1379.5186 618.0137"
  },
  "target": 36944,
  "proteinSpectra": []
},{

  "line": {
  	"x1":"1402.818",
  	"y1":"491.722",
  	"x2":"1392.749",
  	"y2":"491.749",
  	"head": "1401.052,485.777 1411.43,491.732 1401.083,497.743"
  },
  "label": "S272",
  "number": 9,
  "tag": {
  	"type": "S",
  	"position": 272,
  	"matrix": "1 -0.0074 0.0074 1 1422.7207 490.7842"
  },
  "targetProtein": {
  	"name": "Zfp36I2",
  	"matrix": "1 0 0 1 1413.8486 505.7993"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1382.1807 499.5898"
  },
  "target": 7575,
  "proteinSpectra": []
},{

  "line": {
  	"x2":"1522.375",
  	"y2":"490.45",
  	"x1":"1532.444",
  	"y1":"490.424",
  	"head": "1530.678,484.479 1541.056,490.434 1530.709,496.445"
  },
  "label": "S331",
  "number": 10,
  "tag": {
  	"type": "S",
  	"position": 331,
  	"matrix": "1 -0.0074 0.0074 1 1554.2578 490.1143"
  },
  "targetProtein": {
  	"name": "NDRG3",
  	"matrix": "1 0 0 1 1547.9541 506.1318"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1511.8076 498.291"
  },
  "target": 7102,
  "proteinSpectra": []

},{

  "special": {
    "line": "M1871.499,651.385	c-3.647,4.486-7.86,9.679-8.276,10.243",
    "head": "1865.791,649.009 1876.963,644.725 1875.088,656.543"
  },
  "label": "T202",
  "number": 11,
  "tag": {
  	"type": "T",
  	"position": 202,
  	"matrix": "0.6947 0.7193 -0.7193 0.6947 1868.0225 621.002"
  },
  "targetProtein": {
  	"name": "Erk1",
  	"matrix": "0.624 0.7814 -0.7814 0.624 1884.3594 641.8877"
  },
  "protein": {
  	"name": "MEK1/2",
  	"matrix": "1 0 0 1 1826.623 676.7393"
  },
  "target": 33117,
  "proteinSpectra": []
},{
  "special": {
    "line": "M1912.318,706.347 c-3.647,4.486-7.86,9.679-8.276,10.243",
    "head": "1906.61,703.971 1917.782,699.687 1915.907,711.505"
  },
  "label": "T185",
  "number": 12,
  "tag": {
  	"type": "T",
  	"position": 185,
  	"matrix": "0.5085 0.861 -0.861 0.5085 1913.2578 675.7471"
  },
  "targetProtein": {
  	"name": "Erk2",
  	"matrix": "0.4455 0.8953 -0.8953 0.4455 1926.0439 699.8213"
  },
  "protein": {
  	"name": "MEK1/2",
  	"matrix": "1 0 0 1 1855.5186 736.6445"
  },
  "target": 37331,
  "proteinSpectra": []
},{
  "special": {
    "line": "M1931.89,737.167 c-5.771,0.354-12.444,0.77-13.142,0.846",
    "head": "1929.772,731.357 1940.49,736.678 1930.524,743.3"
  },
  "label": "Y187",
  "number": 13,
  "tag": {
  	"type": "Y",
  	"position": 187,
  	"matrix": "0.4072 0.9133 -0.9133 0.4072 1943.2402 731.707"
  },
  "protein": {
  	"name": "MEK1/2",
  	"matrix": "1 0 0 1 1855.5186 736.6445"
  },
  "target": 31143,
  "proteinSpectra": []
},{
  "special": {
    "line": "M1840.098,842.729 c-0.271-3.264-0.53-6.299-0.589-6.686",
    "head": "1845.855,840.489 1840.767,851.318 1833.932,841.496"
  },
  "label": "S29",
  "number": 14,
  "tag": {
  	"type": "S",
  	"position": 29,
  	"matrix": "1 -0.0074 0.0074 1 1832.4404 861.4277"
  },
  "targetProtein": {
  	"name": "c-Raf",
  	"matrix": "1 0 0 1 1820.5557 877.1777"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1834.6553 833.7852"
  },
  "target": 2158,
  "proteinSpectra": []
},{
  "special": {
    "line": "M1696.643,873.145 c-7.169,7.31-18.295,18.662-19.252,19.695",
    "head": "1691.171,870.247 1702.694,867.023 1699.725,878.615"
  },
  "label": "T194",
  "number": 15,
  "tag": {
  	"type": "T",
  	"position": 194,
  	"matrix": "1 0.003 -0.003 1 1694.9854 945.1445"
  },
  "targetProtein": {
  	"name": "Patl1",
  	"matrix": "1 0 0 1 1692.1729 960.9297"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1668.7393 905.002"
  },
  "target": 12727,
  "proteinSpectra": []
},{
  "special": {
    "line": "M1696.095,928.345 c-6.538-7.879-16.693-20.107-17.623-21.165",
    "head": "1699.536,923.197 1701.564,934.989 1690.338,930.851"
  },
  "label": "S184",
  "number": 16,
  "tag": {
  	"type": "S",
  	"position": 184,
  	"matrix": "1 -0.0074 0.0074 1 1698.085 863.8076"
  },
  "targetProtein": {
  	"name": "Patl1",
  	"matrix": "1 0 0 1 1690.7529 852.6816"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1668.7393 905.002"
  },
  "target": 33432,
  "proteinSpectra": []
},{
  "special": {
    "line": "M2168.815,1030.338 c0.474-4.112,0.959-8.262,1.045-8.746",
    "head": "2174.95,1029.287 2167.806,1038.885 2163.065,1027.897"
  },
  "label": "S1161",
  "number": 17,
  "tag": {
  	"type": "S",
  	"position": 1161,
  	"matrix": "1 -0.0074 0.0074 1 2154.3203 1048.1641"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 2166.8369 1018.8818"
  },
  "target": 13002, //sos1
  "proteinSpectra": []
},{
  "special": {
    "line": "M1947.168,1293.54 c5.103-4.943,11.6-11.249,12.214-11.894",
    "head": "1952.558,1296.576 1940.957,1299.508 1944.218,1287.995"
  },
  "label": "T181",
  "number": 16,
  "tag": {
  	"type": "T",
  	"position": 181,
  	"matrix": "1 0.003 -0.003 1 1909.8447 1303.0879"
  },
  "targetProtein": {
  	"name": "A-Raf",
  	"matrix": "1 0 0 1 1900.8916 1330.002"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1963.0693 1277.5566"
  },
  "target": 33705,
  "proteinSpectra": []
//<text transform="matrix()" fill="#F15A29" font-family="'MyriadPro-Bold'" font-size="11.2" class="FS-11.2 tag tag-S186"></text>

},{
	"number": 17,
	"label": "S186",
  "tag": {
  	"type": "S",
  	"position": 186,
  	"matrix": "1 -0.0074 0.0074 1 1909.9521 1315.333"
  },
  "target": 13978
},{
  "line": {
  	"x1": "1852.974",
  	"y1": "1474.908",
  	"x2": "1836.635",
  	"y2": "1440.295",
  	"head": "1857.606,1470.786 1856.62,1482.71 1846.785,1475.894"
  },
  "label": "T198",
  "number": 18,
  "tag": {
  	"type": "T",
  	"position": 198,
  	"matrix": "0.9143 -0.4051 0.4051 0.9143 1847.543 1497.5811"
  },
  "protein": {
  	"name": "PDK1",
  	"matrix": "1 0 0 1 1815.6797 1437.3711"
  },
  "target": 32877,   //pka
  "proteinSpectra": []

},{

  "special": {
    "line": "M1543.268,1399.408 c2.949,0.03,6.376,0.035,10.073-0.062",
    "head": "1544.994,1405.335 1534.66,1399.303 1545.051,1393.369"
  },
  "label": "S544",
  "number": 19,
  "tag": {
  	"type": "S",
  	"position": 544,
  	"matrix": "1 -0.0074 0.0074 1 1504.9873 1399.375"
  },
  "targetProtein": {
  	"name": "ULK1",
  	"matrix": "1 0 0 1 1493.8516 1417.3047"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1555.7979 1408.5498"
  },
  "target": 21933,
  "proteinSpectra": []
},{

  "special": {
    "line": "M1447.101,1396.972 c2.949,0.03,6.376,0.035,10.073-0.062",
    "head": "1448.827,1402.898 1438.493,1396.866 1448.884,1390.933"
  },
  "label": "S771",
  "number": 20,
  "tags": [{
  	"type": "S",
  	"position": 780,
  	"matrix": "1 -0.0074 0.0074 1 1412.7139 1403.6777"
  },{
  	"type": "S",
  	"position": 771,
  	"matrix": "1 -0.0074 0.0074 1 1412.7139 1392.6777"
  }],
  "targetProtein": {
  	"name": "ULK2",
  	"matrix": "1 0 0 1 1365.4736 1427.9609"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1459.6318 1406.1133"
  },
  "target": 15740,
  "proteinSpectra": []
},{
  "line": {
  	"x1": "1167.675",
  	"y1": "1191.413",
  	"x2": "1188.347",
  	"y2": "1191.413",
  	"head": "1169.425,1185.464 1159.063,1191.446 1169.425,1197.43"
  },
  "label": "S266",
  "number": 22,
  "tag": {
  	"type": "S",
  	"position": 266,
  	"matrix": "1 -0.0074 0.0074 1 1126.5 1188.7715"
  },
  "targetProtein": {
  	"name": "MEK2",				 //also known as map2k2? S293, Q3USU3
  	"matrix": "1 0 0 1 1116.6831 1206.1895"
  },
  "target": 27162,
  "proteinSpectra": []
},{

  "special": {
    "line": "M998.512,1191.396 c2.949,0.03,6.376,0.035,10.073-0.062",
    "head": "1000.239,1197.323 989.905,1191.291 1000.295,1185.357"
  },
  "label": "S450",
  "number": 23,
  "tag": {
  	"type": "S",
  	"position": 450,
  	"matrix": "1 0 0 1 957.105 1192.75"
  },
  "targetProtein": {
  	"name": "ULK1",
  	"matrix": "1 0 0 1 949.3403 1212.668"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1011.043 1200.5381"
  },
  "target": 21927,
  "proteinSpectra": []

},{

  "special": {
    "line": "M474.142,1500.637 c2.949,0.03,6.376,0.035,10.073-0.062",
    "head": "475.868,1506.563 465.534,1500.531 475.925,1494.598"
  },
  "label": "S131",
  "number": 24,
  "tag": {
  	"type": "S",
  	"position": 131,
  	"matrix": "1 -0.0074 0.0074 1 428.2314 1499.708"
  },
  "targetProtein": {
  	"name": "Edc3",
  	"matrix": "1 0 0 1 417.7769 1515.9326"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 486.6738 1509.7783"
  },
  "target": 8256,
  "proteinSpectra": []

},{

  "special": {
    "line": "M363.841,1040.616 c0.288-7.099,0.648-16.146,0.648-17.036",
    "head": "369.837,1039.101 363.456,1049.222 357.881,1038.634"
  },
  "label": "S242",
  "number": 25,
  "tag": {
  	"type": "S",
  	"position": 242,
  	"matrix": "1 -0.0074 0.0074 1 351.666 1059.123"
  },
  "targetProtein": {
  	"name": "Cables1",
  	"matrix": "1 0 0 1 333.4072 1078.8555"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 360.1367 1019.1182"
  },
  "target": 29958,
  "proteinSpectra": []
  
},{

  "special": {
    "line": "M1169.506,1054.909 c0.288-7.099,0.647-16.146,0.647-17.036",
    "head": "1175.502,1053.393 1169.12,1063.515 1163.545,1052.927"
  },
  "label": "S264",
  "number": 26,
  "tag": {
  	"type": "S",
  	"position": 264,
  	"matrix": "1 -0.0074 0.0074 1 1158.3623 1075.668"
  },
  "targetProtein": {
  	"name": "Pcbp1",
  	"matrix": "1 0 0 1 1147.2363 1094.1514"
  },
  "protein": {
  	"name": "?",
  	"matrix": "1 0 0 1 1165.8018 1033.4102"
  },
  "target": 5186,
  "proteinSpectra": []
},{
  "number": 27,
  "special": {
    "line": "M2193.355,999.613 L1992.036,969.991",
    "head": "2192.489,993.473 2201.87,1000.899 2190.747,1005.311"
  },
  "label": "S1197",
  "tags": [{
  	"type": "S",
  	"position": 1178,
  	"matrix": "1 -0.0074 0.0074 1 2215.6045 1012.3097"
  },{
  	"type": "S",
  	"position": 1193,
  	"matrix": "1 -0.0074 0.0074 1 2215.6045 998.8697"
  },{
  	"type": "S",
  	"position": 1197,
  	"matrix": "1 -0.0074 0.0074 1 2215.6045 985.4297"
  }],
  "targetProtein": {
  	"name": "SOS1",
  	"matrix": "1 0 0 1 2212.1748 1029.5684"
  },
  "target": 13015,
  "proteinSpectra": []
}];

var points = [{
  "start": {
    "x": 1824.18,
    "y": 478.43
  },
  "number": 0,
  "special": {
    "line": "M1890.817,480.749			c2.443-12.311-3.646-25.67-15.862-32.508c-14.971-8.381-39.269-6.18-48.332,13.214",
    "head": "1896.79,480.912 1887.807,488.816 1885.453,477.083"
  },
  "tag": {
  	"type": "S",
  	"position": 2481,
  	"matrix": "0.8547 0.5192 -0.5192 0.8547 1878.9873 494.8848"
  },
  "protein": {
  	"name": "mTOR",
  	"matrix": "0.9249 0.3803 -0.3803 0.9249 1834.9531 476.7656"
  },
  "relatedSpectra": [11843, 11851],
  "targetSpectra": 11843
},{
  "start": {
    "x": 2166.844,
    "y": 767.867
  },
  "end": {
    "x": 2114.498,
    "y": 776.529
  },
  "label": "S161",
  "number": 1,
  "tag": {
  	"type": "S",
  	"position": 161,
  	"matrix": "1 -0.0074 0.0074 1 2093.1279 788.6143"
  },
  "protein":{
  	"name": "Edc3",
  	"matrix": "1 0 0 1 2087.0869 805.6729"
  },
  "relatedSpectra": [8254,8256],
  "targetSpectra": 8254
}, {
  "start": {
    "x": 1369.863,
    "y": 248.236
  },
  "end": {
    "x": 1368.288,
    "y": 713.504
  },
  "label": "S253",
  "number": 2,
  "tag": {
  	"type": "S",
  	"position": 253,
  	"matrix": "1 -0.0074 0.0074 1 1359.3164 733.498"
  },
  "protein": {
  	"name": "FOXO3A",
  	"matrix": "1 0 0 1 1339.0693 748.6953"
  },
  "relatedSpectra": [4508],
  "targetSpectra": 4508
}, {
  "start": {
    "x": 1323.802,
    "y": 248.236
  },
  "end": {
    "x": 1323.148,
    "y": 301.487
  },
  "label": "S466",
  "number": 3,
  "tag": {
  	"type": "S",
  	"position": 466,
  	"matrix": "1 -0.0074 0.0074 1 1315.3555 319.4033"
  },
  "protein": {
  	"name": "Pfkfb2",
  	"matrix": "1 0 0 1 1299.5498 335.2339"
  },
  "relatedSpectra": [7476,7477],
  "targetSpectra": 7476
}, {
  "start": {
    "x": 1506.119,
    "y": 458.884
  },
  "end": {
    "x": 1505.587,
    "y": 248.809
  },
  "label": "S473",
  "number": 4,
  "tag": {
  	"type": "S",
  	"position": 473,
  	"matrix": "1 -0.0074 0.0074 1 1492.792 240.8662"
  },
  "relatedSpectra": [32613,18051,11851,11843,25972,25965], //mtorc2
  "targetSpectra": 3081
}, {
  "start": {
    "x": 1032.027,
    "y": 550.551
  },
  "end": {
    "x": 1032.093,
    "y": 354.165
  },
  "label": "S642",
  "number": 5,
  "tag": {
  	"type": "S",
  	"position": 642,
  	"matrix": "1 -0.0074 0.0074 1 1019.8926 344.4263"
  },
  "protein":{
  	"name": "c-Raf",
  	"matrix": "1 0 0 1 1012.3804 334.7471"
  },
  "relatedSpectra": [2158,2165,2170],
  "targetSpectra": 2165
}, {
  "start": {
    "x": 1412.043,
    "y": 248.236
  },
  "end": {
    "x": 1409.666,
    "y": 361.691
  },
  "label": "S588",
  "number": 6,
  "tag": {
  	"type": "S",
  	"position": 588,
  	"matrix": "1 -0.0074 0.0074 1 1398.7119 378.375"
  },
  "relatedSpectra": [3081,31272], //akt
  "targetSpectra": 10126
}, {
  "start": {
    "x": 2013.369,
    "y": 1061.971
  },
  "end": {
    "x": 2192.552,
    "y": 1130.224
  },
  "label": "S476",
  "number": 7,
  "tag": {
  	"type": "S",
  	"position": 476,
  	"matrix": "1 -0.0074 0.0074 1 2207.2998 1133.4766"
  },
  "protein":{
  	"name": "Grb10",
  	"matrix": "1 0 0 1 2186.7695 1151.2725"
  },
  "relatedSpectra": [4944],
  "targetSpectra": 4944
}, {
  "start": {
    "x": 1993.749,
    "y": 1115.808
  },
  "end": {
    "x": 2011.994,
    "y": 1117.055
  },
  "label": "S65",
  "number": 8,
  "tag": {
  	"type": "S",
  	"position": 65,
  	"matrix": "1 -0.0074 0.0074 1 2006.8057 1131.1416"
  },
  "protein":{
  	"name": "eIF4EBP1",
  	"matrix": "1 0 0 1 1986.4502 1147.6816"
  },
  "relatedSpectra": [13766,33654,33657],
  "targetSpectra": 13766
}, {
  "start": {
    "x": 1984.344,
    "y": 979.319
  },
  "end": {
    "x": 1925.477,
    "y": 962.784
  },
  "label": "S151",
  "number": 9,
  "tag": {
  	"type": "S",
  	"position": 151,
  	"matrix": "1 -0.0074 0.0074 1 1893.0781 962.8848"
  },
  "protein":{
  	"name": "B-Raf",
  	"matrix": "1 0 0 1 1879.2041 980.2725"
  },
  "relatedSpectra": [11593],
  "targetSpectra": 11593
  //<g>					<line fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" x1="2193.355" y1="999.613" x2="1992.036" y2="969.991"></line>		<g>			<polygon fill="#939598" points="2192.489,993.473 2201.87,1000.899 2190.747,1005.311 			"></polygon>		</g>	</g>
}, {
  "start": {
    "x": 1726.698,
    "y": 1296.509
  },
  "end": {
    "x": 1757.145,
    "y": 1419.953
  },
  "label": "S421",
  "number": 10,
  "tag": {
  	"type": "S",
  	"position": 421,
  	"matrix": "0.9447 -0.3279 0.3279 0.9447 1751.2373 1441.1895"
  },
  "relatedSpectra": [11851,25972,25965,8439,8448,32018,6505], //mtorc1
  "targetSpectra": 19781
}, {
  "start": {
    "x": 1831.245,
    "y": 1205.308
  },
  "end": {
    "x": 1765.609,
    "y": 1051.207
  },
  "label": "S307",
  "number": 11,
  "tag": {
  	"type": "S",
  	"position": 307,
  	"matrix": "1 -0.0074 0.0074 1 1750.2881 1044.0156"
  },
  "protein": {
  	"name": "Hsf1",
  	"matrix": "1 0 0 1 1719.3994 1035.543"
  },
  "relatedSpectra": [6241,6242,6246],
  "targetSpectra": 6242
}, {
  "start": {
    "x": 1757.637,
    "y": 1171.803
  },
  "end": {
    "x": 1726.112,
    "y": 1056.851
  },
  "label": "S303",
  "number": 12,
  "tag": {
  	"type": "S",
  	"position": 303,
  	"matrix": "1 -0.0074 0.0074 1 1707.416 1048.1641"
  },
  "relatedSpectra": [4288,24474], //gsk3
  "targetSpectra": 6241
}, {
  "start": {
    "x": 1478.328,
    "y": 1195.886
  },
  "number": 13,
  "special": {
    "line": "M1470.236,1185.594 L1442.152,1185.594",
    //	no head, use rect instead...			"head": "2192.489,993.473 2201.87,1000.899 2190.747,1005.311",
    "rect": {
      "x": 1440.952,
      "y": 1177.794
    }
  },
  "tag": {
  	"type": "S",
  	"position": 649,
  	"matrix": "1 -0.0074 0.0074 1 1409.0635 1192.8867"
  },
  "protein":{
  	"name": "Gys1",
  	"matrix": "1 0 0 1 1402.4502 1181.3555"
  },
  "relatedSpectra": [5572,5575],
  "targetSpectra": 5575
  //<g>					<line fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" x1="1470.236" y1="1185.594" x2="1442.152" y2="1185.594"></line>		<g>			<rect x="1440.952" y="1177.794" fill="#939598" width="2.4" height="15.6"></rect>		</g>	</g>
}, {
  "start": {
    "x": 1610.905,
    "y": 1473.787
  },
  "end": {
    "x": 1610.442,
    "y": 1442.059
  },
  "label": "S422",
  "number": 14,
  "tag": {
  	"type": "S",
  	"position": 422,
  	"matrix": "1 -0.0074 0.0074 1 1596.9531 1434.8887"
  },
  "protein":{
  	"name": "Eif4b",
  	"matrix": "1 0 0 1 1588.1504 1420.3818"
  },
  "relatedSpectra": [8828,32553],
  "targetSpectra": 8828
}, {
  "start": {
    "x": 1268.984,
    "y": 1524.096
  },
  "end": {
    "x": 1268.135,
    "y": 1305.190
  },
  "label": "T246",
  "number": 15,
  "tag": {
  	"type": "T",
  	"position": 246,
  	"matrix": "1 0.003 -0.003 1 1258.3115 1296.001"
  },
  "protein": {
  	"name": "PRAS40",
  	"matrix": "1 0 0 1 1198.4951 1297.0547"
  },
  "relatedSpectra": [32018,6505],
  "targetSpectra": 32018
}, {
  "start": {
    "x": 1809.559,
    "y": 718.42
  },
  "end": {
    "x": 1794.761,
    "y": 725.733
  },
  "label": "S337",
  "number": 16,
  "tag": {
  	"type": "S",
  	"position": 337,
  	"matrix": "1 -0.0074 0.0074 1 1779.7012 741.5703"
  },
  "relatedSpectra": [],		 //sgk
  "targetSpectra": 1816							//mekk3
}, {
  "start": {
    "x": 1966.192,
    "y": 779.548
  },
  "end": {
    "x": 1913.252,
    "y": 795.343
  },
  "label": "S376",
  "number": 17,
  "tag": {
  	"type": "S",
  	"position": 376,
  	"matrix": "1 -0.0074 0.0074 1 1881.6377 810.1211"
  },
  "protein":{
  	"name": "MSK1",
  	"matrix": "1 0 0 1 1874.626 825.3311"
  },
  "relatedSpectra": [11092],
  "targetSpectra": 11092
}, {
  "start": {
    "x": 1984.611,
    "y": 858.312
  },
  "end": {
    "x": 2001.650,
    "y": 848.021
  },
  "label": "S363",
  "number": 18,
  "tag": {
  	"type": "S",
  	"position": 363,
  	"matrix": "1 -0.0074 0.0074 1 2009.6914 851.0566"
  },
  "protein": {
  	"name": "p90RSK",
  	"matrix": "1 0 0 1 2004.4844 865.7969"
  },
  "relatedSpectra": [1212,19781,19782],
  "targetSpectra": 1212
}, {
  "start": {
    "x": 1846.609,
    "y": 1033.157
  },
  "end": {
    "x": 1818.271,
    "y": 1006.055
  },
  "label": "T346",
  "number": 19,
  "tag": {
  	"type": "T",
  	"position": 346,
  	"matrix": "1 -0.0045 0.0045 1 1788.7939 995.5332"
  },
  "protein": {
  	"name": "NDRG1",
  	"matrix": "1 0 0 1 1752.0791 985.2266"
  },
  "relatedSpectra": [4497,31569,31570],
  "targetSpectra": 31570
}, {
  "start": {
    "x": 1768.405,
    "y": 694.323
  },
  "end": {
    "x": 1719.529,
    "y": 784.055
  },
  "label": "S330",
  "number": 20,
  "tag": {
  	"type": "S",
  	"position": 330,
  	"matrix": "1 -0.0074 0.0074 1 1699.7266 796.5527"
  },
  "relatedSpectra": [],		 //sgk
  "targetSpectra": 4497
}, {
  "start": {
    "x": 1530.201,
    "y": 649.592
  },
  "end": {
    "x": 1528.157,
    "y": 687.165
  },
  "label": "T348",
  "number": 21,
  "tag": {
  	"type": "T",
  	"position": 348,
  	"matrix": "1 -0.0045 0.0045 1 1512.2236 703.9492"
  },
  "protein": {
  	"name": "NDRG2",
  	"matrix": "1 0 0 1 1496.4316 717.665"
  },
  "relatedSpectra": [32167,32169], //sgk
  "targetSpectra": 32169
}, {
  "start": {
    "x": 877.37,
    "y": 1157.973
  },
  "end": {
    "x": 875.986,
    "y": 1122.228
  },
  "label": "T330",
  "number": 22,
  "tag": {
  	"type": "T",
  	"position": 330,
  	"matrix": "1 -0.0045 0.0045 1 863.9429 1113.6699"
  },
  "protein": {
  	"name": "NDRG2",
  	"matrix": "1 0 0 1 858.9595 1081.6074"
  },
  "relatedSpectra": [32167,32169],		 //sgk
  "targetSpectra": 32167
}, {
  "start": {
    "x": 242.098,
    "y": 649.592
  },
  "end": {
    "x": 242.624,
    "y": 525.651
  },
  "label": "S166",
  "number": 23,
  "tag": {
  	"type": "S",
  	"position": 166,
  	"matrix": "1 -0.0074 0.0074 1 232.4365 509.4653"
  },
  "protein":{
  	"name": "MEKK3",
  	"matrix": "1 0 0 1 215.6636 498.123"
  },
  "relatedSpectra": [],		 //sgk
  "targetSpectra": 1818    //mekk 3
}, {
  "start": {
    "x": 1484.554,
    "y": 1301.419
  },
  "number": 25,
  "special": {
    "line": "M1444.872,1276.562			c2.891-5.032,8.662-8.769,15.553-9.42c10.378-0.979,23.158,5.469,23.152,17.32",
    "head": "1451.459,1276.596 1442.892,1284.948 1439.941,1273.352"
  },
  "tag": {
  	"type": "S",
  	"position": 183,
  	"matrix": "0.9835 -0.0074 0.0073 1 1435.291 1296.5645"
  },
  "protein":{
  	"name": "PRAS40",
  	"matrix": "1 0 0 1 1377.751 1297.0547"
  },
  "relatedSpectra": [6505,32018],
  "targetSpectra": 6505
  //<g>		<path fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" d="M1444.872,1276.562			c2.891-5.032,8.662-8.769,15.553-9.42c10.378-0.979,23.158,5.469,23.152,17.32"></path>		<g>			<polygon fill="#939598" points="1451.459,1276.596 1442.892,1284.948 1439.941,1273.352 			"></polygon>		</g>	</g>
}, {
  "start": {
    "x": 1173.403,
    "y": 1301.419
  },
  "number": 26,
  "special": {
    "line": "M1133.72,1276.562			c2.891-5.032,8.663-8.769,15.553-9.42c10.378-0.979,23.16,5.469,23.154,17.32",
    "head": "1140.307,1276.596 1131.739,1284.948 1128.789,1273.352"
  },
  "tag": {
  	"type": "S",
  	"position": 863,
  	"matrix": "1 -0.0074 0.0074 1 1134.4512 1295.123"
  },
  "protein":{
  	"name": "Raptor",
  	"matrix": "1 0 0 1 1079.3281 1297.8818"
  },
  "relatedSpectra": [8439,8448],
  "targetSpectra": 8448
  //<g>		<path fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" d="M1133.72,1276.562			c2.891-5.032,8.663-8.769,15.553-9.42c10.378-0.979,23.16,5.469,23.154,17.32"></path>		<g>			<polygon fill="#939598" points="1140.307,1276.596 1131.739,1284.948 1128.789,1273.352 			"></polygon>		</g>	</g>
}, {
  "start": {
    "x": 713.167,
    "y": 1299.234
  },
  "number": 27,
  "special": {
    "line": "M674.37,1272.183			c3.168-4.862,9.139-8.271,16.055-8.535c10.417-0.398,22.816,6.754,22.148,18.587",
    "head": "680.945,1272.585 671.924,1280.444 669.627,1268.701"
  },
  "tag": {
  	"type": "S",
  	"position": 265,
  	"matrix": "1 -0.0074 0.0074 1 670.8574 1295.123"
  },
  "protein":{
  	"name": "Deptor",
  	"matrix": "1 0 0 1 610.5938 1296.6074"
	},
  "relatedSpectra": [25965,25972],
  "targetSpectra": 25972
  // <g>		<path fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" d="M674.37,1272.183			c3.168-4.862,9.139-8.271,16.055-8.535c10.417-0.398,22.816,6.754,22.148,18.587"></path>		<g>			<polygon fill="#939598" points="680.945,1272.585 671.924,1280.444 669.627,1268.701 			"></polygon>		</g>	</g>
}, {
  "start": {
    "x": 569.137,
    "y": 1299.234
  },
  "number": 28,
  "special": {
    "line": "M529.343,1276.362			c2.546-5.214,8.053-9.33,14.884-10.442c10.289-1.675,23.473,3.9,24.264,15.726",
    "head": "535.917,1275.954 527.93,1284.862 524.208,1273.49"
  },
  "tag": {
  	"type": "S",
  	"position": 877,
  	"matrix": "1 -0.0074 0.0074 1 522.5767 1295.123"
  },
  "protein":{
  	"name": "Raptor",
  	"matrix": "1 0 0 1 466.2627 1297.0547"
	},
  "relatedSpectra": [8439,8448],
  "targetSpectra": 8439
  // <g>		<path fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" d="M529.343,1276.362			c2.546-5.214,8.053-9.33,14.884-10.442c10.289-1.675,23.473,3.9,24.264,15.726"></path>		<g>			<polygon fill="#939598" points="535.917,1275.954 527.93,1284.862 524.208,1273.49 			"></polygon>		</g>	</g>
}, {
  "start": {
    "x": 444.517,
    "y": 1299.234
  },
  "end": {
    "x": 443.871,
    "y": 1258.250
  },
  "label": "S758",
  "number": 29,
  "tag": {
  	"type": "S",
  	"position": 758,
  	"matrix": "1 -0.0074 0.0074 1 432.6172 1251.2646"
  },
  "protein":{
  	"name": "Ulk1",
  	"matrix": "1 0 0 1 429.5591 1240.1611"
	},
  "relatedSpectra": [21925,21927,21933],
  "targetSpectra": 21925
}, {
  "start": {
    "x": 1840.526,
    "y": 548.196
  },
  "number": 30,
  "special": {
    "line": "M1907.164,550.515			c2.443-12.311-3.646-25.67-15.862-32.508c-14.971-8.381-39.269-6.18-48.332,13.214",
    "head": "1913.137,550.678 1904.153,558.582 1901.8,546.85"
  },
  "tag": {
  	"type": "S",
  	"position": 863,
  	"matrix": "0.7738 0.6334 -0.6334 0.7738 1898.7227 578.0488"
  },
  "protein":{
  	"name": "Raptor",
  	"matrix": "0.83 0.5577 -0.5577 0.83 1853.8555 548.6475"
  },
  "relatedSpectra": [8439,8448],
  "targetSpectra": 8448
  //<g>		<path fill="none" stroke="#939598" stroke-width="2.4" stroke-miterlimit="10" d="M1907.164,550.515			c2.443-12.311-3.646-25.67-15.862-32.508c-14.971-8.381-39.269-6.18-48.332,13.214"></path>		<g>			<polygon fill="#939598" points="1913.137,550.678 1904.153,558.582 1901.8,546.85 			"></polygon>		</g>	</g>
}, {
  "start": {
    "x": 363.245,
    "y": 1301.236
  },
  "end": {
    "x": 362.056,
    "y": 1451.466
  },
  "label": "S424",
  "number": 31,
  "tag": {
  	"type": "S",
  	"position": 424,
  	"matrix": "1 -0.0074 0.0074 1 350.1743 1467.4746"
  },
  "relatedSpectra": [],		 //mtorc1
  "targetSpectra": 19781			//ps706k
}, {
  "start": {
    "x": 2158.066,
    "y": 581.044
  },
  "end": {
    "x": 2142.711,
    "y": 580.868
  },
  "label": "S329",
  "number": 32,
  "tag": {
  	"type": "S",
  	"position": 329,
  	"matrix": "1 -0.0074 0.0074 1 2122.0596 593.1099"
  },
  "protein":{
  	"name": "TAK1",
  	"matrix": "1 0 0 1 2114.1963 609.4419"
  },
  "relatedSpectra": [3943],
  "targetSpectra": 3943
}, {
  "start": {
    "x": 1704.986,
    "y": 1545.806
  },
  "end": {
    "x": 1685.674,
    "y": 1429.360
  },
  "label": "S951",
  "number": 33,
  "tag": {
  	"type": "S",
  	"position": 951,
  	"matrix": "1 -0.0074 0.0074 1 1673.2969 1420.041"
  },
  "protein":{
  	"name": "HSL",
  	"matrix": "1 0 0 1 1668.1152 1406.9492"
  },
  "relatedSpectra": [10659,10665],
  "targetSpectra": 10659
}, {
  "start": {
    "x": 773.465,
    "y": 248.236
  },
  "end": {
    "x": 772.542,
    "y": 363.102
  },
  "label": "S318",
  "number": 34,
  "tag": {
  	"type": "S",
  	"position": 318,
  	"matrix": "1 0.0038 -0.0038 1 759.2617 378.0869"
  },
  "relatedSpectra": [3081,31272],		 //akt
  "targetSpectra": 10125		//as160
}, {
  "start": {
    "x": 841.133,
    "y": 248.236
  },
  "end": {
    "x": 839.217,
    "y": 713.034
  },
  "label": "S316",
  "number": 35,
  "tag": {
  	"type": "S",
  	"position": 316,
  	"matrix": "1 -0.0074 0.0074 1 828.4526 728.8672"
  },
  "protein":{
  	"name": "FOXO1A",
  	"matrix": "1 0 0 1 810.3135 745.3242"
  },
  "relatedSpectra": [12914],
  "targetSpectra": 12914
}, {
  "start": {
    "x": 910.449,
    "y": 248.236
  },
  "end": {
    "x": 911.252,
    "y": 276.559
  },
  "labels": ["T1462","S981","S939"],
  "number": 36,
  "tags": [{
  	"type": "T",
  	"position": 1462,
  	"matrix": "1 -0.0045 0.0045 1 895.6846 294.6655"
  },{
  	"type": "S",
  	"position": 981,
  	"matrix": "1 -0.0074 0.0074 1 898.8472 305.332"
  },{
  	"type": "S",
  	"position": 939,
  	"matrix": "1 -0.0074 0.0074 1 898.8472 318.4023"
  }],
  "protein":{
  	"name": "TSC2",
  	"matrix": "1 0 0 1 891.3911 334.2329"
  },
  "relatedSpectra": [11430,11441,33125],
  "targetSpectra": 33125
}, {
  "start": {
    "x": 1189.226,
    "y": 248.236
  },
  "end": {
    "x": 1188.200,
    "y": 301.958
  },
  "label": "S99",
  "number": 37,
  "tag": {
  	"type": "S",
  	"position": 99,
  	"matrix": "1 -0.0074 0.0074 1 1179.7725 319.4033"
  },
  "protein": {
  	"name": "Bad",
  	"matrix": "1 0 0 1 1173.9761 335.2339"
  },
  "relatedSpectra": [26140,26145],
  "targetSpectra": 26140
}, {
  "start": {
    "x": 466.813,
    "y": 198.328
  },
  "end": {
    "x": 467.193,
    "y": 249.091
  },
  "label": "Y896",
  "number": 38,
  "tag": {
  	"type": "Y",
  	"position": 896,
  	"matrix": "1 -0.0045 0.0045 1 454.7056 264.9893"
  },
  "relatedSpectra": [37334,37336,37335],		 //igf1r
  "targetSpectra": 37636
}, {
  "start": {
    "x": 667.803,
    "y": 198.328
  },
  "end": {
    "x": 667.217,
    "y": 248.339
  },
  "label": "Y612",
  "number": 39,
  "tag": {
  	"type": "Y",
  	"position": 612,
  	"matrix": "1 -0.0045 0.0045 1 655.4185 264.0513"
  },
  "relatedSpectra": [37334,37336,37335],		 //igf1r
  "targetSpectra": 37640
}, {
  "start": {
    "x": 504.187,
    "y": 247.46
  },
  "end": {
    "x": 503.586,
    "y": 568.169
  },
  "label": "S9",
  "number": 40,
  "tag": {
  	"type": "S",
  	"position": 9,
  	"matrix": "1 -0.0074 0.0074 1 497.3613 586.2051"
  },
  "protein": {
  	"name": "Gsk3a",
  	"matrix": "1 0 0 1 445.8418 586.9922"
  },
  "relatedSpectra": [24474],
  "targetSpectra": 24474
}, {
  "start": {
    "x": 439.1,
    "y": 247.46
  },
  "end": {
    "x": 438.981,
    "y": 249.091
  },
  "label": "S527",
  "number": 41,
  "tag": {
  	"type": "S",
  	"position": 527,
  	"matrix": "1 -0.0074 0.0074 1 427.5303 264.0513"
  },
  "relatedSpectra": [3081,31272],		 // akt
  "targetSpectra": 23681
}, {
  "start": {
    "x": 550.448,
    "y": 247.46
  },
  "end": {
    "x": 548.726,
    "y": 432.712
  },
  "label": "T86",
  "number": 42,
  "tag": {
  	"type": "T",
  	"position": 86,
  	"matrix": "1 -0.0045 0.0045 1 546.9644 451.8623"
  },
  "protein": {
  	"name": "Sin1",
  	"matrix": "1 0 0 1 512.3882 452.8979"
  },
  "relatedSpectra": [32613],
  "targetSpectra": 32613
}, {
  "start": {
    "x": 622.291,
    "y": 247.46
  },
  "end": {
    "x": 622.077,
    "y": 570.051
  },
  "label": "S21",
  "number": 44,
  "tag": {
  	"type": "S",
  	"position": 21,
  	"matrix": "1 -0.0074 0.0074 1 614.2085 586.2051"
  },
  "protein":{
  	"name":"Gsk3b",
  	"matrix":"1 0 0 1 562.478 586.9922"
  }  ,
  "relatedSpectra": [4288],
  "targetSpectra": 4288
}, {
  "start": {
    "x": 710.262,
    "y": 247.46
  },
  "end": {
    "x": 708.594,
    "y": 363.102
  },
  "label": "T642",
  "number": 45,
  "tag": {
  	"type": "T",
  	"position": 642,
  	"matrix": "1 -0.0045 0.0045 1 701.918 377.835"
  },
  "relatedSpectra": [3081,31272],		//akt
  "targetSpectra": 32814
}, {
  "start": {
    "x": 85.378,
    "y": 198.459
  },
  "end": {
    "x": 84.636,
    "y": 249.091
  },
  "label": "Y465",
  "number": 46,
  "tag": {
  	"type": "Y",
  	"position": 465,
  	"matrix": "1.0366 -0.0013 0.0013 1 74.4858 265.7559"
  },
  "relatedSpectra": [37334,37336,37335],		 //igf1r
  "targetSpectra": 37639
}, {
  "start": {
    "x": 125.594,
    "y": 198.459
  },
  "end": {
    "x": 126.014,
    "y": 250.973
  },
  "label": "Y1179",
  "number": 47,
  "tag": {
  	"type": "Y",
  	"position": 1179,
  	"matrix": "1 -0.0013 0.0013 1 110.9209 265.6675"
  },
  "relatedSpectra": [37334,37336,37335],		 //igf1r
  "targetSpectra": 37643
}, {
  "start": {
    "x": 1750.499,
    "y": 337.42
  },
  "end": {
    "x": 1762.787,
    "y": 251.631
  },
  "label": "S703",
  "number": 48,
  "tag": {
  	"type": "S",
  	"position": 703,
  	"matrix": "1 -0.0074 0.0074 1 1775.6768 258.3833"
  },
  "protein":{
  	"name": "Nhe1",
  	"matrix": "1 0 0 1 1758.7822 240.3398"
  },
  "relatedSpectra": [17539,37554],
  "targetSpectra": 17539
}, {
  "start": {
    "x": 1684.427,
    "y": 328.068
  },
  "end": {
    "x": 1683.793,
    "y": 701.275
  },
  "label": "S92",
  "number": 49,
  "tag": {
  	"type": "S",
  	"position": 466,
  	"matrix": "1 -0.0074 0.0074 1 1672.8369 717.3477"
  },
  "protein":{
  	"name": "Brf1",
  	"matrix": "1 0 0 1 1665.7158 733.2793"
  },
  "relatedSpectra": [7591],
  "targetSpectra": 7591
}, {
  "start": {
    "x": 1622.657,
    "y": 277.376
  },
  "end": {
    "x": 1633.012,
    "y": 279.852
  },
  "label": "S855",
  "number": 50,
  "tag": {
  	"type": "S",
  	"position": 855,
  	"matrix": "1 -0.0074 0.0074 1 1625.8838 293.5063"
  },
  "protein": {
  	"name": "HSL",
  	"matrix": "1 0 0 1 1622.6504 308.397"
  },
  "relatedSpectra": [10659,10665],
  "targetSpectra": 10665
}, {
  "start": {
    "x": 1165.965,
    "y": 1524.096
  },
  "end": {
    "x": 1164.690,
    "y": 1594.919
  },
  "label": "S295",
  "number": 51,
  "tag": {
  	"type": "S",
  	"position": 295,
  	"matrix": "1 -0.0074 0.0074 1 1155.5688 1613.165"
  },
  "protein":{
  	"name": "Pde3b",
  	"matrix": "1 0 0 1 1139.481 1628.3496"
  },
  "relatedSpectra": [25879],
  "targetSpectra": 25879
}, {
  "start": {
    "x": 1215.724,
    "y": 1245.324
  },
  "end": {
    "x": 1215.942,
    "y": 1210.652
  },
  "label": "S301",
  "number": 52,
  "tag": {
  	"type": "S",
  	"position": 301,
  	"matrix": "1 -0.0074 0.0074 1 1204.4287 1203.1953"
  },
  "protein":{
  	"name": "c-Raf",
  	"matrix": "1 0 0 1 1195.917 1191.7656"
  },
  "relatedSpectra": [2158,2165,2170],
  "targetSpectra": 2170
}, {
  "start": {
    "x": 1033.392,
    "y": 1302.702
  },
  "end": {
    "x": 1033.504,
    "y": 1105.296
  },
  "label": "S326",
  "number": 53,
  "tag": {
  	"type": "S",
  	"position": 326,
  	"matrix": "1 -0.0074 0.0074 1 1020.5342 1098.2598"
  },
  "protein":{
  	"name": "HSF1",
  	"matrix": "1 0 0 1 1006.1602 1086.6465"
  },
  "relatedSpectra": [6241,6242,6246],
  "targetSpectra": 6246
/*}, {
  "start": {
    "x": 876.234,
    "y": 1302.702
  },
  //weird, there is no arrow coming from this point... why is this point included?
  "number": 54*/
}, {
  "start": {
    "x": 917.128,
    "y": 1302.262
  },
  "end": {
    "x": 916.894,
    "y": 1376.211
  },
  "label": "T45",
  "number": 55,
  "tag": {
  	"type": "T",
  	"position": 45,
  	"matrix": "1 -0.0045 0.0045 1 907.2212 1391.3818"
  },
  "protein":{
  	"name": "Eif4ebp1",
  	"matrix": "1 0 0 1 862.6035 1423.5254"
  },
  "relatedSpectra": [13766,33654,33657],
  "targetSpectra": 33657
}, {
  "start": {
    "x": 795.079,
    "y": 1301.157
  },
  "end": {
    "x": 795.112,
    "y": 1383.737
  },
  "label": "T2000",
  "number": 56,
  "tag": {
  	"type": "T",
  	"position": 2000,
  	"matrix": "1 -0.0045 0.0045 1 779.2202 1400.5488"
  },
  "protein":{
  	"name": "Numa1",
  	"matrix": "1 0 0 1 765.2271 1412.9004"
  },
  "relatedSpectra": [33202],
  "targetSpectra": 33202
}, {
  "start": {
    "x": 1345.772,
    "y": 1301.157
  },
  "end": {
    "x": 1345.248,
    "y": 1105.296
  },
  "label": "S68",
  "number": 57,
  "tag": {
  	"type": "S",
  	"position": 68,
  	"matrix": "1 -0.0074 0.0074 1 1337.7803 1096.207"
  },
  "protein":{
  	"name": "MAF1",
  	"matrix": "1 0 0 1 1321.5186 1065.8418"
  },
  "relatedSpectra": [13269,13271],
  "targetSpectra": 13271
}, {
  "start": {
    "x": 1048.329,
    "y": 1477.651
  },
  "end": {
    "x": 1048.550,
    "y": 1428.889
  },
  "label": "T420",
  "number": 58,
  "tag": {
  	"type": "T",
  	"position": 420,
  	"matrix": "1 -0.0045 0.0045 1 1034.1235 1413.6777"
  },
  "protein":{
  	"name": "Eif4b",
  	"matrix": "1 0 0 1 1013.3354 1393.7656"
  },
  "relatedSpectra": [8828,32553],
  "targetSpectra": 32553
}, {
  "start": {
    "x": 2055.073,
    "y": 600.932
  },
  "end": {
    "x": 2012.935,
    "y": 622.258
  },
  "label": "S236",
  "number": 59,
  "tag": {
  	"type": "S",
  	"position": 236,
  	"matrix": "1 -0.0074 0.0074 1 1992.8818 635.7954"
  },
  "protein": {
  	"name": "RPS6",
  	"matrix": "1 0 0 1 1982.8916 650.6621"
  },
  "relatedSpectra": [1143,1144],
  "targetSpectra": 1143
},{
	"start": {
		"x": 1794.04,
		"y": 427.759
	},
	"end": {
		"x": 1805,
		"y": 397.719
	},
	"label": "T37",
	"number": 60,
	"tag": {
		"type": "T",
		"position": 37,
		"matrix": "1 -0.0045 0.0045 1 1805.8545 391.1147"
	},
	"protein": {
		"name": "eIF4EBP1",
		"matrix": "1 0 0 1 1775.6367 379.4209"
	},
	"relatedSpectra": [33657,33654,13766],
	"targetSpectra": 33654
},{

	"start": {
		"x": 1733.991,
		"y": 607.379
	},
  "end": {
    "x": 1739.032,
    "y": 576.437
  },
	"label": "S641",
	"number": 61,
	"tag": {
		"type": "S",
		"position": 641,
		"matrix": "1 -0.0074 0.0074 1 1742.0469 571.2729"
	},
	"protein": {
		"name": "Gys1",
		"matrix": "1 0 0 1 1702.8564 571.2729"
	},
	"relatedSpectra": [5575, 5572],
	"targetSpectra": 5572
},{
	"start": {
		"x": 1450.604,
		"y": 248.236
	},
  "end": {
    "x": 1450.352,
    "y": 312.417
  },
	"label": "S1177",
	"number": 62,
	"tag": {
		"type": "S",
		"position": 1177,
		"matrix": "1 -0.0074 0.0074 1 1435.165 332.8735"
	},
	"protein": {
		"name": "eNOS",
		"matrix": "1 0 0 1 1428.8613 348.7041"
	},
	"relatedSpectra": [23370],
	"targetSpectra": 23370
},{
	"start": {
		"x": 1110.822,
		"y": 248.236
	},
  "end": {
    "x": 1110.631,
    "y": 302.114
  },
	"label": "S483",
	"number": 63,
	"tag": {
		"type": "S",
		"position": 483,
		"matrix": "1 -0.0074 0.0074 1 1098.4932 319.4033"
	},
	"protein": {
		"name": "Pfkfb2",
		"matrix": "1 0 0 1 1085.3735 335.2339"
	},
	"relatedSpectra": [7476,7477],
	"targetSpectra": 7477
},{
	"start": {
		"x": 1836.503,
		"y": 1266.097
	},
  "special": {
    "line": "M1779.444,1256.664 c0.549-9.452,7.308-18.645,17.721-22.727c13.568-5.317,33.329-1.318,38.045,15.017",
    "head": "1785.445,1254.207 1780.689,1265.187 1773.559,1255.577"
  },
	"label": "S2448",
	"number": 64,
	"tag": {
		"type": "S",
		"position": 2448,
		"matrix": "0.9598 -0.2151 0.2185 0.9758 1755.9326 1285.4551"
	},
	"protein": {
		"name": "mTOR",
		"matrix": "0.9289 -0.3233 0.3287 0.9445 1787.9404 1278.917"
	},
	"relatedSpectra": [11851,11843],
	"targetSpectra": 11851
},{
	"start": {
		"x": 1851.701,
		"y": 1326.778
	},
  "special": {
    "line": "M1794.643,1317.346 c0.549-9.452,7.308-18.645,17.721-22.727c13.568-5.317,33.329-1.318,38.045,15.017",
    "head": "1800.644,1314.889 1795.888,1325.868 1788.757,1316.259"
  },
	"label": "S2448",
	"number": 65,
	"tag": {
		"type": "S",
		"position": 2448,
		"matrix": "0.9835 -0.0074 0.0073 1 1783.084 1336.5059"
	},
	"protein": {
		"name": "mTOR",
		"matrix": "0.9836 0 0 1 1816.8809 1337.4473"
	},
	"relatedSpectra": [11851,11843],
	"targetSpectra": 11851
},{
	"start": {
		"x": 1636.379,
		"y": 1301.419
	},
  "special": {
    "line": "M1597.667,1276.562 c2.891-5.032,8.662-8.769,15.553-9.42c10.378-0.979,23.158,5.469,23.152,17.32",
    "head": "1604.254,1276.596 1595.687,1284.948 1592.736,1273.352"
  },
	"label": "S293",
	"number": 66,
	"tag": {
		"type": "S",
		"position": 293,
		"matrix": "0.9835 -0.0074 0.0073 1 1591.2607 1296.5645"
	},
	"protein": {
		"name": "Deptor",
		"matrix": "1 0 0 1 1533.0332 1297.5547"
	},
	"relatedSpectra": [25972,25965],
	"targetSpectra": 25965
},{
	"start": {
		"x": 589.68,
		"y": 1361.306
	},
  "special": {
    "line": "M549.998,1336.449 c2.891-5.032,8.662-8.769,15.553-9.42c10.378-0.979,23.158,5.469,23.152,17.32",
    "head": "556.585,1336.482 548.018,1344.835 545.067,1333.238"
  },
	"label": "S1479",
	"number": 67,
	"tag": {
		"type": "S",
		"position": 1479,
		"matrix": "1 -0.0074 0.0074 1 539.7778 1354.2832"
	},
	"protein": {
		"name": "Rictor",
		"matrix": "1 0 0 1 490.5898 1356.4629"
	},
	"relatedSpectra": [18051],
	"targetSpectra": 18051
}, {
  "start": {
    "x": 471.868,
    "y": 422.168
  },
  "end": {
    "x": 472.835,
    "y": 377.024
  },
  "label": "S240",
  "number": 24,
  "tag": {
  	"type": "S",
  	"position": 240,
  	"matrix": "1 -0.0074 0.0074 1 455.6099 366.3091"
  },
  "protein": {
  	"name": "Rps6",
  	"matrix": "1 0 0 1 452.0952 353.5103"
  },
  "relatedSpectra": [1143,1144],
  "targetSpectra": 1144
}, {
  "start": {
    "x": 587.679,
    "y": 247.46
  },
  "end": {
    "x": 588.223,
    "y": 284.085
  },
  "label": "S47",
  "number": 43,
  "tag": {
  	"type": "S",
  	"position": 47,
  	"matrix": "1 -0.0074 0.0074 1 578.8354 299.3853"
  },
  "protein": {
  	"name": "EI24",
  	"matrix": "1 0 0 1 571.3921 315.2158"
  },
  "relatedSpectra": [1800],
  "targetSpectra": 1800
}];

































    

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    