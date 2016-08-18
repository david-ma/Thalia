// racetrack file........

var MINARDO = MINARDO || {};

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

		if (MINARDO.data.numberOfTimePoints % 2 == 0) {
			// even
			console.log('do even stuff here...');
		} else {
			// odd
			var boxWidth = 2 * width / (MINARDO.data.numberOfTimePoints + 1),
					boxHeight = height / 2;
			
			for (var i = 0; i < MINARDO.data.numberOfTimePoints; i++) {
				console.log('hey');
				var box = background.append("svg:rect")
					.attr("stroke", "black")
					.attr("width", boxWidth)
				if (i == (MINARDO.data.numberOfTimePoints + 1)/2) {
					box.attr("fill", "rgba(255,255,255,.5)")
					.attr("height", boxHeight * 2)
					.attr("x", boxWidth * (i - 1))
					.attr("y", 0);
					console.log('ho');
				} else if (i % 2 == 0) {
					if ( i < MINARDO.data.numberOfTimePoints / 2) {
						box.attr("fill", "rgba(255,255,255,.5)")
						.attr("height", boxHeight)
						.attr("x", boxWidth * i)
						.attr("y", 0);
					} else {
											box.attr("fill", "rgba(255,255,255,.5)")
						.attr("height", boxHeight)
						.attr("x", boxWidth * (MINARDO.data.numberOfTimePoints - i))
						.attr("y", boxHeight);
					}
				}
			}
		}

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
			var dat = MINARDO.data.getFirstActivation(kinase);
			var place = dat.position * 2;
			if (dat.before_or_after == 'after'){
				place++;
			}
			positions[place].push(kinase);
		});

// woo, got the positions
		this.positions = positions;
		racetrack = d3.select("#racetrack").datum(positions);
//now place them in the boxes...

		var boxes = null;
		var spawnPoint = -300;
		racetrack.datum().forEach(function(d,i){
			boxes = racetrack.append("svg:g")
			.datum(d)
			.attr('id', 'box_'+i)
			.each(function(d){
				var box = d3.select(this);
				d.forEach(function(id){
					var node = box.append('svg:g')
						.attr("id", "node_"+id);

					node.append("svg:circle")
						.attr("fill", 'rgba(#111,0.5)')
						.attr("r", 7.5)
						.attr("cx", spawnPoint)
						.attr("cy", parseInt(MINARDO.heatmap.getYPos(id)) + 5)
					.transition().duration(500)
					.transition().duration((500 * i) / MINARDO.racetrack.speed)
					.transition().duration(1000 / MINARDO.racetrack.speed)
						.attr("cx", MINARDO.racetrack.randx(i))
						.attr("cy", MINARDO.racetrack.randy(i));

				});
			});
		});

//<circle fill="#939598" r="7.5" cx="125.594" cy="188.459"></circle>


		// find out how many time points we have
			//can be more sophisticated later......
/*		boxes = [];
		for(var i = 0; i < MINARDO.data.numberOfTimePoints; i++) {
			var box = racetrack.append("svg:g")
				.attr("id", "box-"+i)

				boxes.push(box);
		}*/
		

		// select the major kinases
		Object.keys(kinase_data).forEach(function(kinase,i,list){
			var timepoints = MINARDO.data.numberOfTimePoints;
//			console.log(list);
		
		
		});



		// draw tracks for the major kinases
		// draw lines between related proteins????





	},
	"createBackdrop": function(){
		// The background is created based on the width and height of the vis
		// There is no other information needed to generate the background
		// It is always the same?
				// Perhaps it could be different if we need more space in the cytoplasm or nucleus
	var r = d3.select("#racetrack");
	console.log(this);

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





















    

    
    
    
    
    
    
    
    
    
    
    
    
    
  
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    