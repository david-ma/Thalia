var MINARDO = MINARDO || {};

MINARDO.heatmap = { // Heat Map Highlighter
	"that": this,
	"init": function (data, svg, x, y, width, height){
		this.data = data;
		this.SVG = svg;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;

		this.rowOrder = Object.keys(MINARDO.data.include);

		this.heatmap = this.SVG.append("g")
				.attr("id", "heatmap") //declare heatmap area. Perhaps plug in width and height here?
				.attr("transform", MINARDO.helper.matrix(x,y,1));

		this.initLabels();
		this.initRows();
		this.activation.initArrows();
		this.sorting.sortByActivation();
	},
	"initLabels": function (){
		console.log("initialising labels");
		var labels = this.labels = this.heatmap.append("g")
				.attr("id", "labels")
				.classed("svgButton", true);

		labels.append('svg:text')
					.attr('x', 60)		//hard coded..
					.attr('y', 0)
					.attr("style", "font-size: 12px; text-anchor: end;")
					.text("Gene");

		labels.append('svg:text')
					.attr('x', 65)   //hard coded...
					.attr('y', 0)
					.attr("style", "font-size: 8px; text-anchor: start;")
					.text("Residue");


		//draw the labels
		labels.selectAll(".label")
				.data(this.rowOrder)
			.enter().append("g")
				.classed("label", true)
				.attr("id", function (d){return "label_"+d;})
				.datum(function (d, i) {
					return data = {
								"id": d,
								"name": MINARDO.data.getName(d),
								"residue": MINARDO.data.getResidue(d)
							};
				}).each(function (d, i){
					var thing = d3.select(this),
							rowX = 65;		// hard code.
				
					thing.attr("transform",function(d){
							var y = i * MINARDO.heatmap.rHeight + 8;
							return MINARDO.helper.matrix(0,y,1);
						})

					thing.append('svg:text')
						.attr('x', rowX)
						.attr('y', 0)
						.attr('class','label')
						.attr("style", "font-size: 8px; text-anchor: end;")
						.text(function (d){return d.name;});

					thing.append('svg:text')
						.attr('x', rowX+5)
						.attr('y', 0)
						.attr('class','label')
						.attr("style", "font-size: 8px; text-anchor: start;")
						.text(function (d){return d.residue;});
				});

		
	},
	"rHeight": 10,
	"rWidth": 25,			//variables for the rows.
	"rOffset": 100,
	"initRows": function (){	// used to be called buildHeatmap
		console.log("initialising rows");
		this.rFullWidth = this.rWidth * full_data[Object.keys(full_data)[0]].time_course.length; // this is silly. Fix it.

		this.rows = this.heatmap.append("g")
				.attr("id", "rows")
				.classed("svgButton", true);

		//draw the rows
		this.rows.selectAll(".row")
				.data(this.rowOrder)
			.enter().append("g")
				.classed("row", true)
				.attr("id", function (d){return "row_"+d;})
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
							.attr('x', function (d, i){return (i * MINARDO.heatmap.rWidth) + MINARDO.heatmap.rOffset;})
							.attr('y', 0)
							.style('fill',function(d) {
								return colour_scale(d);
							});
				});


		// draw outlines
		this.heatmap.insert("svg:rect", "g")
				.classed("outline",true)
				.classed("unselected_outline",true)
				.attr("id", function(d){return "big_outline"})
				.attr("width", MINARDO.heatmap.rFullWidth)
				.attr("height", MINARDO.heatmap.rHeight * Object.keys(MINARDO.data.data).length)
				.attr("x", MINARDO.heatmap.rOffset)
				.attr("y", 0);

		this.rows.selectAll(".row")
			.each(function (d, i) {
				d3.select(this).append("svg:rect")
					.classed("outline",true)
					.classed("unselected_outline",true)
					.attr("id", function(d){return "outline_"+d.id;})
					.attr("width", MINARDO.heatmap.rFullWidth)
					.attr("height", MINARDO.heatmap.rHeight)
					.attr("x", MINARDO.heatmap.rOffset)
					.attr("y", 0);
			});

	},
	"colourScale": {
		"getColourScale": function (id){
			var AA = MINARDO.data.getAminoAcid(id);

			if (AA == "S") {
				return this.colorScale_S;
			} else if (AA == "T") {
				return this.colorScale_T;
			} else if (AA == "Y"){
				return this.colorScale_Y;
			} else {
				console.log('problem with:');
				console.log(id);
			}
		},
    "colorScale_S": d3.scale.linear()
			.domain([minData, 0, maxData])
      .range(["white", "white", "red"]),
    "colorScale_T": d3.scale.linear()
      .domain([minData, 0, maxData])
      .range(["white", "white", "green"]),
    "colorScale_Y": d3.scale.linear()
      .domain([minData, 0, maxData])
      .range(["white", "white", "blue"])
	},
	"activation": {
		"initArrows": function (){
			console.log("initialising arrows");
			var rows = MINARDO.heatmap.rows.selectAll(".row");
			this.arrows = MINARDO.heatmap.heatmap.append("svg:g").attr("id", "arrows");
			
			this.arrows.selectAll(".arrows")
					.data(MINARDO.data.getActivationData())
				.enter().append("svg:g")
					.attr("id", function (d){return "arrows_"+d.id;})
					.classed("arrows", true)
				.attr("transform",function(d,i){
					var y = (i * MINARDO.heatmap.rHeight) + MINARDO.heatmap.rHeight/5;
					return MINARDO.helper.matrix(0,y,1);
				});

			MINARDO.heatmap.activation.drawArrows();
		},
		"drawArrows": function (){
//			console.log(this.arrows.selectAll(".arrow").datum().changes);
			var heatmapOffset = MINARDO.heatmap.rOffset,
					w = MINARDO.heatmap.rWidth,
					h = MINARDO.heatmap.rHeight;
			
			this.arrows.selectAll(".arrows").data()
				.forEach(function (row_data, i){
//					console.log(row_data);
					row_data.changes.forEach(function(arrow, i){
						var this_arrow = null;
						if (arrow.before_or_after == "before") {
							this_arrow = MINARDO.heatmap.activation.drawArrow(heatmapOffset+w/4+(arrow.position*w) - 2, row_data, arrow.up_or_down);
						} else {
							this_arrow = MINARDO.heatmap.activation.drawArrow(heatmapOffset+(3*w)/4+(arrow.position*w) - 2, row_data, arrow.up_or_down);
						}
						if (i == 0){
							this_arrow.classed("firstArrow",true);
							this_arrow.style("display", "");
						} else {
							this_arrow.style("display", "none");
						}
					});
				});
		},
		"drawArrow": function (x, row_data, type){
			var upshow = "",
					downshow = "none";
			var row = row_data.id;
			var opacity = 0.65;
			var y = 0;//51 + currentOrder.indexOf(row)* h;

			var arrow = d3.select("#arrows_"+row).insert("svg:g",".outline").append("svg:g")
					.attr("transform","translate("+x+","+y+"), scale(0.010)")
					.classed("arrow", true)
					.classed(type,true);

			var path = arrow.append("svg:path")
					.attr("style", "fill:#000000;fill-opacity:"+opacity+";fill-rule:evenodd;stroke:#000000;stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1");
			if(type == "down") {
				arrow.style("display", downshow);
				path.attr("d","M 499.53144,345.56874 L 250.03515,594.5 L 0.5,344.60333 L 0.55719,206.14946 L 193.54163,397.45903 L 193.61312,0.8336513 L 304.60242,0.9565913 L 304.6229,400.06947 L 499.53144,206.70304 L 499.53144,345.56874 z ");
			} else {
				arrow.style("display", upshow);
				path.attr("d","M 0.5,249.76491 L 249.99629,0.8336513 L 499.53144,250.73032 L 499.47425,389.18419 L 306.48981,197.87462 L 306.41832,594.5 L 195.42902,594.37706 L 195.40854,195.26418 L 0.5,388.63061 L 0.5,249.76491 z ");
			}
			return arrow;
		},
		"upshow": "none",
		"toggleUp": function (){
			if(MINARDO.heatmap.activation.upshow == "none") {
				MINARDO.heatmap.activation.upshow = "";
				d3.selectAll(".up").style("display", MINARDO.heatmap.activation.upshow);
			}
			else {
				MINARDO.heatmap.activation.upshow = "none";
				d3.selectAll(".up").style("display", MINARDO.heatmap.activation.upshow);
			}
		},
		"downshow": "none",
		"toggleDown": function (){
			if(MINARDO.heatmap.activation.downshow == "none") {
				MINARDO.heatmap.activation.downshow = "";
				d3.selectAll(".down").style("display", MINARDO.heatmap.activation.downshow);
			}
			else {
				MINARDO.heatmap.activation.downshow = "none";
				d3.selectAll(".down").style("display", MINARDO.heatmap.activation.downshow);
			}
		},
		"firstArrowShow": "",
		"showOnlyFirst": function (){
			if (MINARDO.heatmap.activation.firstArrowShow == "" && MINARDO.heatmap.activation.upshow == "none" && MINARDO.heatmap.activation.downshow == "none") {
				MINARDO.heatmap.activation.firstArrowShow = "none";
					d3.selectAll(".firstArrow").style("display", MINARDO.heatmap.activation.firstArrowShow);
					d3.selectAll(".up").style("display", MINARDO.heatmap.activation.upshow);
					d3.selectAll(".down").style("display", MINARDO.heatmap.activation.downshow);
			} else {
				// First turn off the arrows.
				MINARDO.heatmap.activation.upshow = "none";
				MINARDO.heatmap.activation.downshow = "none";
				d3.selectAll(".up").style("display", MINARDO.heatmap.activation.upshow);
				d3.selectAll(".down").style("display", MINARDO.heatmap.activation.downshow);
			
				MINARDO.heatmap.activation.firstArrowShow = "";
				d3.selectAll(".firstArrow").style("display", MINARDO.heatmap.activation.firstArrowShow);
			}
		}
	},
	"sorting": {
		"order": null,
		"sortByActivation": function (){
//		unselect();
			if (MINARDO.heatmap.sorting.order == null) {
				MINARDO.heatmap.sorting.order = Object.keys(MINARDO.data.include);
			}
			var oldOrder = MINARDO.heatmap.sorting.order;

			var arrays = [];
			var newOrder = [];
			var sort_hash = {}
			MINARDO.heatmap.sorting.sort_hash = sort_hash;

			for(var i = 0; i < MINARDO.data.numberOfRows * 2; i++){
				arrays.push([]);
			}

			downregulated = [];
			oldOrder.forEach(function (d){
				var upPos = d3.select("#arrows_"+d).data()[0].ups[0],
						downPos = d3.select("#arrows_"+d).data()[0].downs[0];

				if (typeof upPos === 'undefined'){
					arrays[downPos].push(d);
				} else {
					if (typeof downPos === 'undefined'){
						arrays[upPos].push(d);
					} else {
						if (downPos > upPos){
							arrays[upPos].push(d);
						} else {
							arrays[downPos].push(d);
						}
					}
				}
			});

			arrays.forEach(function (d, i){
				newOrder = newOrder.concat(d);
			});

			cols.forEach(function (time, i){
				sort_hash[time] = arrays[(i*2)].concat(arrays[(i*2)+1]);
			});
			MINARDO.heatmap.sorting.order = newOrder.concat(downregulated);
			MINARDO.heatmap.animate.moveRows(oldOrder, MINARDO.heatmap.sorting.order);
			MINARDO.heatmap.sorting.drawBundles();
		},
		"sortByCluster": function (){
			var oldOrder = MINARDO.heatmap.sorting.order;
			var arrays = {};
			var newOrder = [];

			allClusters.forEach(function (d){
				arrays[d] = [];
			});

			oldOrder.forEach(function (id){
				arrays[MINARDO.data.getCluster(id)].push(id);
			});

			Object.keys(arrays).forEach(function (key){
				if (arrays[key].length < 1) {
					delete arrays[key];
				} else {
					newOrder = newOrder.concat(arrays[key]);
				}
			});
			MINARDO.heatmap.sorting.sort_hash = arrays;
			MINARDO.heatmap.sorting.order = newOrder;
			MINARDO.heatmap.animate.moveRows(oldOrder, MINARDO.heatmap.sorting.order);
			MINARDO.heatmap.sorting.drawBundles();
		},
		"sortByUniprot": function (){
			var uniprotHash = [];
			var newOrder = [];
			var oldOrder = this.order;

			oldOrder.forEach(function (id){
				var uniprot = MINARDO.data.data[id].Uniprot.split(";")[0].substring(0,6);
				if (typeof uniprotHash[uniprot] === "undefined"){
					uniprotHash[uniprot] = [];
				}
				uniprotHash[uniprot].push(id);
			});

			Object.keys(uniprotHash).forEach(function (d,i){
				newOrder = newOrder.concat(uniprotHash[d]);
			});
			MINARDO.heatmap.sorting.order = newOrder
			MINARDO.heatmap.sorting.sort_hash = uniprotHash;
			MINARDO.heatmap.animate.moveRows(oldOrder, MINARDO.heatmap.sorting.order);
			MINARDO.heatmap.sorting.drawBundles();
		},
		"sortByGeneName": function (){
			var geneNameHash = [];
			var newOrder = [];
			var oldOrder = MINARDO.heatmap.sorting.order;
			var sort_hash = {};

			oldOrder.forEach(function (id){
				var uniprot = MINARDO.data.data[id].h_name;
				if (typeof geneNameHash[uniprot] === "undefined"){
					geneNameHash[uniprot] = [];
				}
				geneNameHash[uniprot].push(id);
			});

			Object.keys(geneNameHash).sort(function (a, b) {
					return a.toLowerCase().localeCompare(b.toLowerCase());
			}).forEach(function (d,i){
				newOrder = newOrder.concat(geneNameHash[d]);
				sort_hash[d] = geneNameHash[d];
			});
			MINARDO.heatmap.sorting.order = newOrder
			MINARDO.heatmap.sorting.sort_hash = sort_hash;
			MINARDO.heatmap.animate.moveRows(oldOrder, MINARDO.heatmap.sorting.order);
			MINARDO.heatmap.sorting.drawBundles();
		},
		"sortByResidue": function (){
			var oldOrder = MINARDO.heatmap.sorting.order;
  		var sort_hash = {
  			"Serine": [],
  			"Threonine": [],
  			"Tyrosine":[]
  		};

			MINARDO.heatmap.sorting.order.forEach(function (d,i){
				switch (MINARDO.data.data[d].Amino_Acid){
				case "S":
					sort_hash.Serine.push(d);
					break;
				case "T":
					sort_hash.Threonine.push(d);
					break;
				case "Y":
					sort_hash.Tyrosine.push(d);
					break;
				default:
					console.log("error, amino acid not found for: "+d.id);
				}
			});

			MINARDO.heatmap.sorting.sort_hash = sort_hash;
  		MINARDO.heatmap.sorting.order = sort_hash.Serine.concat(sort_hash.Threonine).concat(sort_hash.Tyrosine);
			MINARDO.heatmap.animate.moveRows(oldOrder, MINARDO.heatmap.sorting.order);
			MINARDO.heatmap.sorting.drawBundles();
		
		},
		"drawBundles": function (){
			d3.select("#bundle_box").remove();
			var bundle_box = MINARDO.heatmap.heatmap.append("svg:g").attr("id","bundle_box");

			var sort_label_height = 0;
			var label_positions = {};
			var sort_hash = this.sort_hash;
			var h = MINARDO.heatmap.rHeight;
			
	    var heatmapBundles = bundle_box.selectAll(".sort_label")
					.data(Object.keys(sort_hash))
				.enter().append("g")
					.classed("sort_label", true)
					.attr("id", function (d){return d});


			d3.selectAll(".sort_label")
				.append('svg:text')
				.attr('x', 365) //hardcoded...
				.attr('y', function(d,i) {
					var label_height = ((sort_hash[d].length/2) * h) + sort_label_height;
					sort_label_height = sort_label_height + (sort_hash[d].length)*h;
					label_positions[d] = label_height;
					return label_height + 3; //magic number just to place the text..
				})
				.attr('class','bundleLabel')
				.style('text-anchor','start')
				.style('font-size','10px')
				.style('opacity','0.5')
				.text(function(d) {
					if (sort_hash[d][0]){
						return d;
					}
					return "";
				});

			var bundleStrings = bundle_box.append("svg:g").attr("id","bundleStrings");

			bundle_links = [];
			Object.keys(sort_hash).forEach(function (d, i){
				var parent = {
											 x: 364,
											 y: label_positions[d]
										 };

				sort_hash[d].forEach(function (id){
					var target = {
										x: 330,
										y: MINARDO.heatmap.sorting.order.indexOf(id)*h + 5
									 };
					var source = parent;
					bundle_links.push({
						parent: parent,
						source: source,
						target: target
					});
				});
			});


			bundle_links.forEach( function (link){
				var startX = link.source.x,
						startY = link.source.y,
						stopX = link.target.x,
						stopY = link.target.y;

				bundleStrings.append("path")
					.classed("bundleStrings", true)
					.attr("d", "M"+startX+","+startY+","+stopX+","+stopY)
					.attr("style","stroke:black; opacity:0.2;");
			});

			var hit_box = heatmapBundles.each( function (d,i){
				if(sort_hash[d][0]) {
					var min = MINARDO.heatmap.sorting.order.indexOf(sort_hash[d][0]),
							max = MINARDO.heatmap.sorting.order.indexOf(sort_hash[d][sort_hash[d].length - 1]),
							height = ((1 + max - min) * h),
							y = min*h, // + heatmapOffsetTop
							protein_hash = [];

					sort_hash[d].forEach(function (d, i){
						if (typeof protein_hash[MINARDO.data.data[d].h_name] === 'undefined'){
							protein_hash[MINARDO.data.data[d].h_name] = [];
						}
						protein_hash[MINARDO.data.data[d].h_name].push(MINARDO.data.data[d]);
					});

					var box = bundle_box.append("svg:g")
											.attr("class","hit_box")
											.attr("id", "hit_box_"+d);

				}
			});



		},
		"getBundlePosition": function (id) {
//			console.log();
			var sort_hash = MINARDO.heatmap.sorting.sort_hash;
			var sort_keys = Object.keys(sort_hash);
			var bundle = this.getBundle(id);
			var x = 365;
			var h = MINARDO.heatmap.rHeight;
			var y = 0;
			var counter = 0;
			sort_keys.forEach(function (key){
				if (key == bundle){
					y = counter + ((h * sort_hash[key].length) / 2);
				}
				counter = counter + h * sort_hash[key].length;
			});
			
			var pos = {"x": x, "y": y};		
			return pos;
		},
		"getBundle": function (id) {
			var bundle = null;
			Object.keys(MINARDO.heatmap.sorting.sort_hash).forEach(function (key){
				if (MINARDO.heatmap.sorting.sort_hash[key].indexOf(id) != -1){
					bundle = key;
				}
			});
			return bundle;
		},
		"bundleIndex": function (id) {
			var bundle = this.getBundle(id);
			return Object.keys(MINARDO.heatmap.sorting.sort_hash).indexOf(bundle) + 1;
		},
		"numberOfBundles": function (){return Object.keys(this.sort_hash).length;}
	},
	"animate": {
		"moveRows": function (oldOrder, newOrder) {
			oldOrder.forEach(function (spectra) {
				MINARDO.heatmap.animate.moveRow(spectra, oldOrder.indexOf(spectra), newOrder.indexOf(spectra))
			});
		},
		"moveRow": function (spectra, oldPos, newPos){
			var label = d3.select("#label_"+spectra),
					row = d3.select("#row_"+spectra),
					arrows = d3.select("#arrows_"+spectra);
			var distance = Math.sqrt((oldPos - newPos) * (oldPos - newPos));

			var duration = 200;

			if (MINARDO.heatmap.sorting.numberOfBundles() > 12){
				duration = 20;
			} else if (MINARDO.heatmap.sorting.numberOfBundles() < 4){
				duration = 500;
			}

			var bP = MINARDO.heatmap.sorting.getBundlePosition(spectra); // bP = bundle position

			row.transition().duration(duration)
				.attr("transform",function(d,i){
					var y = (newPos * MINARDO.heatmap.rHeight);
					return MINARDO.helper.matrix(bP.x,bP.y,0);
				}).transition().delay(duration*MINARDO.heatmap.sorting.bundleIndex(spectra)).duration(duration)
				.attr("transform",function(d,i){
					var y = (newPos * MINARDO.heatmap.rHeight);
					return MINARDO.helper.matrix(0,y,1);
				})

			label.transition().duration(duration)
				.attr("transform",function(d,i){
					var y = newPos * MINARDO.heatmap.rHeight + 8;
					return MINARDO.helper.matrix(bP.x,bP.y,0);
				}).transition().delay(duration*MINARDO.heatmap.sorting.bundleIndex(spectra)).duration(duration)
				.attr("transform",function(d,i){
					var y = newPos * MINARDO.heatmap.rHeight + 8;
					return MINARDO.helper.matrix(0,y,1);
				})


			arrows.transition().duration(duration)
				.attr("transform",function(d,i){
					var y = (newPos * MINARDO.heatmap.rHeight) + MINARDO.heatmap.rHeight/5;
					return MINARDO.helper.matrix(bP.x,bP.y,0);
				}).transition().delay(duration*MINARDO.heatmap.sorting.bundleIndex(spectra)).duration(duration)
				.attr("transform",function(d,i){
					var y = (newPos * MINARDO.heatmap.rHeight) + MINARDO.heatmap.rHeight/5;
					return MINARDO.helper.matrix(0,y,1);
				})


			// display the outline while animating? Or not?
			d3.select("#big_outline")
				.style("display", "none")
				.transition()
				.delay(duration*(Object.keys(MINARDO.heatmap.sorting.sort_hash).length + 20))
				.style("display", "");

//		alternative shuffle animation
/*		row.transition().duration(duration)
				.attr("transform",function(d,i){
					var y = (newPos * MINARDO.heatmap.rHeight);
					return MINARDO.helper.matrix(0,y);
				})

			label.transition().duration(duration)
				.attr("transform",function(d,i){
					var y = newPos * MINARDO.heatmap.rHeight + 8;
					return MINARDO.helper.matrix(0,y);
				})

			arrows.transition().duration(duration)
				.attr("transform",function(d,i){
					var y = (newPos * MINARDO.heatmap.rHeight) + MINARDO.heatmap.rHeight/5;
					return MINARDO.helper.matrix(0,y);
				})
*/
		}
	},
	"highlight":{
		"init": function (){
			d3.selectAll(".outline")
				.on('mouseover', function(d,i) {
					console.log("mousing over!");
					if (!MINARDO.heatmap.highlight.selected) {
						var id = d3.select(this).datum().id;
						MINARDO.helper.highlight.brushProtein(id);

//						console.log(d3.select(this).datum());
//					console.log(this);
//						d3.select(this).classed("heavy_outline", true);
//						cluster_info.style("display","");
					}
				})
				.on('mouseout', function(d,i) {
					if (!MINARDO.heatmap.highlight.selected) {
							MINARDO.helper.highlight.unselect();
//						d3.select(this).classed("heavy_outline", false);
//						d3.selectAll(".cluster_outline").style("display","none");
//						d3.selectAll(".cluster_info").style("display","none");
					}
				})
				.on('mousedown', function(d,i) {
					if(!MINARDO.heatmap.highlight.selected){
							MINARDO.heatmap.highlight.selected = this;
							d3.selectAll(".selected").classed("selected", false);
							d3.select(this).classed("selected", true);
					} else {
						MINARDO.helper.unselect();
					}
				});		
		},
		"spectra": function (id){
			d3.select("#outline_"+id).classed("heavy_outline", true);
		}
	},
	"getYPos": function(id){
			return $("#row_"+id).position().top - $("#heatmap").position().top - .5;
//		return d3.select("#row_"+id).attr("transform").substring(17,21).split(")")[0];
	}
}

MINARDO.helper = {
	"highlight": {
		"brushProtein": function (id){
			// get all the spectra, and then highlight them.
			MINARDO.data.getAllSpectra(id).forEach(function (spectra){
				MINARDO.heatmap.highlight.spectra(spectra);
			});
		},
		"brushTargets": function (id){
			// get all the spectra...
			MINARDO.data.getAllSpectra(id).forEach(function (spectra){
				// then highlight their targets
				MINARDO.heatmap.highlight.target(spectra);
			});
		},
		"unselect": function() {
			d3.selectAll(".heavy_outline").classed("heavy_outline", false);
			delete MINARDO.heatmap.highlight.selected;
		}
	},
	"init": function (){
		var sort = MINARDO.heatmap.sorting;

		this.buildButton(sort.sortByResidue, "Sort By Residue", 85, 20, 10, 5);
		this.buildButton(sort.sortByActivation, "Sort By First Regu.", 100, 20, 100, 5);
		this.buildButton(sort.sortByCluster, "Sort By Cluster", 85, 20, 205, 5);
		this.buildButton(sort.sortByGeneName, "Sort By Name", 85, 20, 295, 5);

		var toggle_group = d3.select("#vis").append("svg:g")
			.attr("id", "toggle_group")
			.attr("transform", "matrix(1 0 0 1 400 5)");

		this.buildButton(MINARDO.heatmap.activation.toggleUp, "Up regulation", 90, 20, 100, 0, "toggle", toggle_group);
		this.buildButton(MINARDO.heatmap.activation.toggleDown, "Down regulation", 90, 20, 200, 0, "toggle", toggle_group);
		this.buildButton(MINARDO.heatmap.activation.showOnlyFirst, "First regulation", 90, 20, 300, 0, "toggle", toggle_group);
		this.buildButton(MINARDO.racetrack.showTargets, "Show Targets", 90, 20, 400, 0, "toggle", toggle_group, "show_targets_button");

	},
	"matrix": function (x, y, size) {
		return "matrix("+size+" 0 0 "+size+" "+x+" "+y+")";
	},
	"buildButton": function (callback, text, w, h, x, y, class_value, group, rectId){
		var button = null;
		if (typeof group != 'undefined'){
		 button = group.append("svg:g").classed("svgButton",true);
		} else {
			button = d3.select("#vis").append("svg:g").classed("svgButton",true);
		}
		if(typeof class_value != 'undefined'){
			button.classed(class_value, true);
		}
		button.append("svg:rect")
				.attr("width", w)
				.attr("height", h)
				.attr("x", x)
				.attr("y", y)
				.attr("fill", "#aaaaaa")
				.attr("id", rectId)
				.on("click", callback);
		button.append("svg:text")
				.attr("x", x + 2)
				.attr("y", y + 15)
				.text(text)
				.style('fill','black')
				.style('font-size', 11)
				.on("click", callback);

		return button;
	}
}

MINARDO.data = {
	"data": {},
	"init": function(){
		// Make a uniprot lookup hash table.
		var uniprotLookup = {};
//console.log(MINARDO.data.include);
	MINARDO.data.numberOfRows = Object.keys(MINARDO.data.include).length;
		Object.keys(MINARDO.data.include).forEach(function(id){
			MINARDO.data.data[id] = minardo_data[id];
		});

		Object.keys(MINARDO.data.data).forEach(function (id){
			var uniprot = MINARDO.data.data[id].Uniprot.split(";")[0].substring(0,6);
			
			if (typeof uniprotLookup[uniprot] === 'undefined'){
				uniprotLookup[uniprot] = [id];
			} else {
				uniprotLookup[uniprot].push(id);
			}
		});

		this.uniprotLookup = uniprotLookup;

		this.numberOfTimePoints = MINARDO.data.data[Object.keys(MINARDO.data.data)[0]].time_course.length;

		
	
	
	},
	"getCluster": function (id) {
//		console.log("write a function here to get the cluster based on ID...");
		return clusterLookup[id];
	},
	"numberOfRows": 0,
	"getTimeCourse": function (id) {
		return this.data[id].time_course;
	},
	"getName": function (id) {
		return this.data[id].h_name;
	},
	"getResidue": function (id) {
		return this.data[id].h_number;
	},
	"getAminoAcid": function (id) {
		return this.data[id].Amino_Acid;
	},
	"getPlaceOf": function(id){
		var that = this,
				data = that.getTimeCourse(id),
				min = Math.min.apply(Math, data),
				max = Math.max.apply(Math, data),
				half = (max + min) / 2,
				val = null;
		
		if (data[0] > half) {
			for(i = 1; data[i] > half; i++){}
			var high = data[i-1],
					low = data[i],
					gapL = half - low,
					gapH = high - half;
					
					val = i - (gapL / (gapL + gapH)) - 0.5;
		} else {
			for(i = 1; data[i] < half; i++){}
			var high = data[i],
					low = data[i-1],
					gapL = half - low,
					gapH = high - half;
					
					val = i + (gapL / (gapL + gapH)) - 0.5;
		}
//console.log(val);

		return val;
	},
	"getActivationData": function () {
		var activationData = [];
		Object.keys(this.data).forEach(function (id){
			var row_data = MINARDO.data.getTimeCourse(id);
			var upsA = [],			// a for after
					upsB = [],			// b for before
					downsA = [],
					downsB = [],
					ups = [],
					downs =[],
					changes = [];

			for(var i = 1; i < row_data.length; i++){
				var front = row_data[i-1],
						back = row_data[i],
						regulation = {
													"position": null,
													"before_or_after": "",
													"up_or_down": ""
												 };

				if(front < 50 && 50 < back){
					regulation.up_or_down = "up";
					var change = back - front;
					if (change/2 + (front*1) < 50) {
						regulation.position = i;
						regulation.before_or_after = "before";
						upsB.push(i);
						ups.push(i*2);
					} else {
						regulation.position = i-1;
						regulation.before_or_after = "after";
						upsA.push(i-1);
						ups.push((i*2)-1);
					}
				} else if (front > 50 && 50 > back){
					regulation.up_or_down = "down";
					var change = front - back;
					if (change/2 + (back*1) < 50) {
						regulation.position = i-1;
						regulation.before_or_after = "after";
						downsA.push(i-1);
						downs.push((i*2)-1);
					} else {
						regulation.position = i;
						regulation.before_or_after = "before";
						downsB.push(i);
						downs.push(i*2);
					}
				}
				if (regulation.position != null) {
					changes.push(regulation);
				}
			}

			activationData.push({
				"id": id,
				"upsA": upsA,
				"upsB": upsB,
				"downsA": downsA,
				"downsB": downsB,
				"ups": ups,
				"downs": downs,
				"changes": changes
			});
		});

		this.activationData = activationData;
		return activationData;
	},
	"getAllSpectra": function (id){
		return MINARDO.data.uniprotLookup[MINARDO.data.getUniprot(id)];
	},
	"getUniprot": function (id){
		return MINARDO.data.data[id].Uniprot.split(";")[0].substring(0,6);
	},
	"getFirstActivation": function (id) {
		var dat = null;
		this.activationData.forEach(function (data){
			if (data.id == id) {
				dat = data.changes[0];
			}
		});
		return dat;
	},
	"getSizeOfTimePoints": function () {
		var that = this;
		var sizes = {};
		Object.keys(this.data).forEach(function(site){
			var timepoint = that.getFirstActivation(site).position;
			if (typeof sizes[timepoint] == "number"){
				sizes[timepoint]++;
			} else {
				sizes[timepoint] = 1;
			}
		});
//		console.log(this.getFirstActivation(6246));
		return sizes;
	},
	"getTargetingSpectraOf": function (id){
		var parents = {};
		Object.keys(kinase_data).forEach(function(group){
			Object.keys(kinase_data[group].substrates).forEach(function(substrate){
				if (substrate == id) {
					Object.keys(kinase_data[group].phosphosites).forEach(function(phosphosite){
						parents[phosphosite] = 1;
					});
				}
			});
		});
		return Object.keys(parents);
	},
	"getSubstrateSpectraOf": function (id){
		var children = {};
		Object.keys(kinase_data).forEach(function(group){
			Object.keys(kinase_data[group].phosphosites).forEach(function(phosphosite){
				if (phosphosite == id) {
					Object.keys(kinase_data[group].substrates).forEach(function(substrate){
						children[substrate] = 1;
					});
				}
			});
		});
		return Object.keys(children);
	},
	"getMostActiveKinases": function(){
		return Object.keys(kinase_data).sort(function(a,b){
			return (Object.keys(kinase_data[b].substrates).length +
			 Object.keys(kinase_data[b].phosphosites).length) -
			(Object.keys(kinase_data[a].substrates).length +
			 Object.keys(kinase_data[a].phosphosites).length);
		});
	}
}










		// find space
		// designate heatmap and race track areas
		
		// take the data
		// calculate Mostly Activated point
		// start generating race track
		
		// feed data to heatmap?
		// draw labels
		// draw heatmap
			// draw rows in order
		// draw arrows	
		// label rows































































