var MINARDO = MINARDO || {};

MINARDO.hmh = { // Heat Map Highlighter
	"SVG": "blah",
	"init": function (){

		MINARDO.hmh.SVG = d3.select("#vis");

		var vis_width = 1900;
    //height of each row in the heatmap
    var h = 10;
    //width of each column in the heatmap
    var w = 25;
    var heatmapOffsetTop = 50;
    var heatmapOffsetLeft = 100;
    var heatmapOffset = heatmapOffsetLeft;
    var numberOfRows = Object.keys(cols).length;
    var rowWidth = w*numberOfRows;// $(".row")[0].getBoundingClientRect().width;

    var endOfRow = rowWidth + 5 + heatmapOffset;
    var clusterWidth = 66;

    var startOfClusterLabel = rowWidth + heatmapOffsetLeft * 1.7;
    var rowHeightCounter = 54;
    selected = false;
    info_selected = false;

    clusters = {};
    clusterTypes = {};
    cluster_array = [];
    var database = minardo_data;
    var counter = 0;
    var upshow = "",
    		downshow = "none",
    		firstArrowShow = "";
    var row_values;
 		var bundle_links = [];

		var sort_label_height = 0;
		var sort_hash = {};
    var cluster_label_height = 0;	//continuing counter.
    uniprotDB = {};
    var arrows;
    var uniprotHash = {};

    //cheating with this hard-coded cluster array..
    orderedClusters = ["Cluster_A", "Cluster_B", "Cluster_C", "Cluster_D", "Cluster_E", "Cluster_F", "Cluster_H", "Cluster_J", "Cluster_L", "Cluster_M", "Cluster_N", "Cluster_R", "Cluster_1", "Cluster_5", "Cluster_30"];
		findCluster();
    currentOrder = originalOrder;

	  var heatmap = MINARDO.hmh.SVG.append("g")
	    	.attr("id", "heatmap");

    //define a color scale using the min and max expression values
    var colorScale_S = d3.scale.linear()
      .domain([minData, 0, maxData])
      .range(["white", "white", "red"]);

    var colorScale_T = d3.scale.linear()
      .domain([minData, 0, maxData])
      .range(["white", "white", "green"]);

    var colorScale_Y = d3.scale.linear()
      .domain([minData, 0, maxData])
      .range(["white", "white", "blue"]);

    //label columns
    var columnLabel = MINARDO.hmh.SVG.append("svg:g").attr("id","colLabel");
    
    columnLabel.selectAll(".colLabel")
      .data(cols)
      .enter().append('svg:text')
      .attr('x', function(d,i) {
        return ((i + 0.5) * w) + heatmapOffset;
      })
      .attr('y', 40)
      .attr('class','label')
      .style('text-anchor','middle')
      .style('font-size',12)
      .text(function(d) {return d;});

		columnLabel.append('svg:text')
      .attr('x',heatmapOffset)
      .attr('y', 20)
      .attr('class','time')
      .style('text-anchor','start')
      .style('font-size',20)
      .text("Time");

		var expLabTop = Number($("#heatmap").offset().top) + (d3.selectAll(".row")[0].length * h);
		var expLabLeft = rowWidth + 105 + $("#heatmap").offset().left;

    //expression value label
    var expLab = d3.select("body")
      .append('div')
      .classed("label", true)
      .style('height',40)
      .style('position','absolute')
      .style('background','FFE53B')
      .style('opacity',0.8)
      .style('top',expLabTop)
      .style('left',expLabLeft)
      .style('padding',10)
      .style('display','none')
      .on("click", aquaria);


		d3.selectAll(".row").each(function(d){
			bundle_links.push({
				parent: clusterTypes[d.cluster],
				source: d.end,
				target: {
									x: startOfClusterLabel - 35,
									y: $("#label_"+d.cluster).attr("y")-4
								}//d3.select("#"+d.cluster)
			});
		});


		buildButton(spectraHeatmap, "Sort By Residue", 85, 20, 10, 5);
		buildButton(changeSort, "Sort By First Regu.", 100, 20, 100, 5);
		buildButton(clusterSort, "Sort By Cluster", 85, 20, 205, 5);
		buildButton(uniprotSort, "Sort By Uniprot", 85, 20, 295, 5);

		MINARDO.page.initialise();


	},
	"unselect": function (){
		d3.selectAll(".cluster_outline").style("display","none");
		d3.selectAll(".cluster_info").style("display","none");
		d3.selectAll(".outline").style("cursor", "pointer");
		d3.selectAll(".brushed_circle")
			.attr("r", 0);

		d3.selectAll(".brushed")
		//					.attr('stroke','none') not sure if needed?
				.classed("brushed",false)
				.attr("stroke", "rgba(1,1,1,0.2)");

		d3.selectAll(".temp").remove();
		d3.selectAll(".value").remove();
		expLab.style('display','none');

		var wasSelected = selected;
		selected = false;
	},
	"drawOutlineOnId": function (id){
		d3.select("#outline_"+id)
			.attr("stroke", "rgba(1,1,1,1)")
				.classed("brushed",true)
				.attr('stroke-width', 1)
				.attr('stroke','black');

		d3.select("#row_"+id)
			.insert("svg:rect","g")
				.classed("temp",true)
				.attr("width", 2*w+5)
				.attr("height", h)
				.attr("fill", "#BEBEBE")
				.attr("stroke", "none")
				.attr("x", heatmapOffset - (2*w+5))
				.attr("y", function(d){return currentOrder.indexOf(d)*h+50});

		var value_array = getData(id);
	
		row_values = d3.select("#row_"+id).insert("svg:g",".outline").attr("id","values");

		value_array.forEach(function (d, i){
			row_values.append("svg:text")
				.classed("value", true)
				.attr("x", heatmapOffset+w/2+i*w)
				.style("text-anchor", "middle")
				.attr("y", function(d){return currentOrder.indexOf(d)*h+6+(heatmapOffsetTop*1)})
				.attr("font-size", 5)
				.text(Math.floor(d)+"%");
		});
	},
	"showInformation": function (){

					expLab
						.style('top',currentOrder.indexOf(d)*h+$("#heatmap").position().top+h+2)
						.style('display','block')
						.html(
							minardo_data[d].Gene_Names.split(";")[0]+"<br>"+
							minardo_data[d].Protein_Names.split(";")[0]+"<br>"+
							minardo_data[d].Uniprot.split(";")[0]
						);

					uniprotDB[getUniprot(d3.select(this).data())].forEach(function(id){
						MINARDO.hmh.drawOutlineOnId(id);
					});

	},
	"brushUniprot": function (uniprot){
//		MINARDO.hmh.drawOutlineOnId(spectra);
		uniprotDB[uniprot].forEach(function(id){
			MINARDO.hmh.drawOutlineOnId(id);
			MINARDO.rth.highlightId(id);
		});
	},
	"unbrush": function (){
		unselect();
		MINARDO.rth.unhighlight();
	},
	"brushRelated": function(spectra){
		if (spectra) {
			var uniprot = database[spectra].Uniprot.split(";")[0];//.substring(0,6);
			uniprotDB[uniprot].forEach(function (id){
				MINARDO.hmh.drawOutlineOnId(id);
			});
		}
	},
	"highlightActivator": function (spectraID, colour){
		MINARDO.hmh.drawOutlineOnId(spectraID);
//		d3.select("#outline_"+spectraID).attr("fill", colour);
		d3.select("#row_"+spectraID)
					.insert("svg:rect","g")
						.classed("temp",true)
						.attr("width", 2*w+5)
						.attr("height", h)
						.attr("fill", colour)
						.attr("stroke", "none")
						.attr("x", heatmapOffset - (2*w+5))
						.attr("y", function(d){return currentOrder.indexOf(d)*h+50});
	},
	"highlightTarget": function (spectraID, colour){
		MINARDO.hmh.drawOutlineOnId(spectraID);
//		d3.select("#outline_"+spectraID).attr("fill", colour);
	}
}

MINARDO.page = {
	"initialise": function() {
		//click anywhere unselect only needs to be made once.
		MINARDO.hmh.SVG.on("mousedown", function(){
				if(event.button != 0){
					unselect();
				}
		});
		MINARDO.hmh.SVG.insert("svg:rect","g")
			.attr("id","unselect")
			.attr("height", vis_width)
			.attr("width", vis_width)
			.attr("fill", "#dddddd")
			.on("mousedown", function(d){
				unselect();
			});

		toggle_group = MINARDO.hmh.SVG.append("svg:g")
			.attr("transform","translate(400,5)");

		toggle_group.append("svg:text")
					.attr("x", 50)
					.attr("y", 17)
					.text("Toggles")
					.style("text-anchor", "middle")
					.style('fill','black')
					.style('font-size', 15);

		buildButton(toggleUp, "Up regulation", 90, 20, 100, 0, "toggle", toggle_group);
		buildButton(toggleDown, "Down regulation", 90, 20, 200, 0, "toggle", toggle_group);
		buildButton(showOnlyFirst, "First regulation", 90, 20, 300, 0, "toggle", toggle_group);
		buildButton(MINARDO.rth.showTargets, "Show Targets", 90, 20, 400, 0, "toggle", toggle_group, "show_targets_button");
		
//function buildButton(callback, text, w, h, x, y, class_value, group){


	}
}
		function buildMouseEvents(){
    //heatmap mouse events
    heatmapRow
      .on('mouseover', function(d,i) {
      	if(!selected) {
					expLab
						.style('top',currentOrder.indexOf(d)*h+$("#heatmap").position().top+h+2)
						.style('display','block')
						.html(
							minardo_data[d].Gene_Names.split(";")[0]+"<br>"+
							minardo_data[d].Protein_Names.split(";")[0]+"<br>"+
							minardo_data[d].Uniprot.split(";")[0]
						);

					MINARDO.hmh.brushUniprot(getUniprot(d3.select(this).data()));
/*
					uniprotDB[getUniprot(d3.select(this).data())].forEach(function(id){
						MINARDO.hmh.drawOutlineOnId(id);
					});
*/
				}
      })
      .on('mouseout', function(d,i) {
      	if(!selected){
					unselect();
					MINARDO.hmh.unbrush();
        }
      });

			d3.selectAll(".row").on("mousedown", function(d){ //overwrite clickthrough to aquaria?
      	if(!selected){
						selected = this;
						d3.selectAll(".selected").classed("selected", false);
						d3.select(this).classed("selected", true);
						d3.selectAll(".outline").style("cursor","default");
				} else {
					unselect();
        }
			});
		}



		function drawClusterLabels(){
			cluster_label_height = 0;	
	    heatmapClusters = heatmap.selectAll(".cluster")
				.data(orderedClusters) //used to be "data", now "cluster_array"
			.enter().append("g")
				.classed("cluster", true)
				.attr("id", function (d){return d})
				.datum(function (d){return clusterTypes[d]});

			d3.selectAll(".cluster")
				.append('svg:text')
				.attr('x', startOfClusterLabel -30)
				.attr('y', function(d,i) {
					var label_height = ((d.length/2) * h) + cluster_label_height;
					cluster_label_height = cluster_label_height + (d.length)*h;
					return label_height + 54; //magic number just to place the text..
				})
				.attr('class','clusterLabel')
				.style('text-anchor','start')
				.style('font-size','10px')
				.style('opacity','0.5')
				.text(function(d) {
				d3.select(this).attr('id','label_'+d[0].cluster);
				return d[0].cluster;});

			var clusterStrings = MINARDO.hmh.SVG.append("svg:g").attr("id","clusterStrings");
			bundle_links.forEach( function (link){
				var startX = link.source.x,
						startY = link.source.y,
						stopX = link.target.x,
						stopY = link.target.y;

				clusterStrings.append("path")
					.classed("clusterStrings", true)
					.attr("d", "M"+startX+","+startY+","+stopX+","+stopY)
					.attr("style","stroke:black; opacity:0.2;");
			});
		}
 
 		uniprotDB = buildUniprot();
 		identifyRows();

 		function identifyRows(){
 			d3.selectAll(".row").each(function (d){
 				d3.select(this).attr("id","row_"+d.id);
 			});
 		}

 		function getUniprot(id){
 			return minardo_data[id].Uniprot.split(";")[0];
 		}

 
 		function buildUniprot(){
 			var uniprot = {};
 				Object.keys(minardo_data).forEach( function(id){
	 				if (typeof uniprot[minardo_data[id].Uniprot.split(";")[0]] === 'undefined'){
	 					uniprot[minardo_data[id].Uniprot.split(";")[0]] = [];
	 				}
 					uniprot[minardo_data[id].Uniprot.split(";")[0]].push(id);
 				});

 			return uniprot;
 		}
 


    // Click through to Aquaria
    function aquaria(){
    	var Uniprot = getUniprot(d3.select(selected).data()).substring(0,6);
    	window.open('http://www.uniprot.org/uniprot/'+Uniprot, '_blank');
    }

    function findCluster(){
    	clusters = {};
    	cluster.data.forEach(function (row,i){
    		var this_cluster = "null",
    				weight = 0;

    		Object.keys(row).forEach(function(key){
    			if (key != 'id'){
						if (row[key] > weight){
							weight = row[key];
							this_cluster = key;
						}
    			}
    		});

				var thing = {
					"id": row.id,
					"cluster": this_cluster,
    			"weight": weight
				};

    		// save it to a hashmap
    		clusters[row.id] = thing;

    		//save to hashmap, with cluster as the key.
    		if (!clusterTypes[this_cluster]) { clusterTypes[this_cluster] = [];}
				clusterTypes[this_cluster].push(thing);

				//save to array..
				cluster_array.push(thing)

//    		console.log(row.id+" is in "+this_cluster+" and has the weight of "+weight);
    	});

    	var order = [];
    }

  	mapBuilderInit();

		function drawLabels(){
			var cluster_box = MINARDO.hmh.SVG.append("svg:g").attr("id","cluster_box");

			sort_label_height = 0;
			var label_positions = {};
			
	    heatmapClusters = cluster_box.selectAll(".sort_label")
				.data(Object.keys(sort_hash))
			.enter().append("g")
				.classed("sort_label", true)
				.attr("id", function (d){return d});

			d3.selectAll(".sort_label")
				.append('svg:text')
				.attr('x', startOfClusterLabel - 30)
				.attr('y', function(d,i) {
					var label_height = ((sort_hash[d].length/2) * h) + sort_label_height;
					sort_label_height = sort_label_height + (sort_hash[d].length)*h;
					label_positions[d] = label_height + 50;
					return label_height + 52; //magic number just to place the text..
				})
				.attr('class','clusterLabel')
				.style('text-anchor','start')
				.style('font-size','10px')
				.style('opacity','0.5')
				.text(function(d) {
					if (sort_hash[d][0]){
						return d;
					}
					return "";
				});

			var clusterStrings = cluster_box.append("svg:g").attr("id","clusterStrings");

			bundle_links = [];
			Object.keys(sort_hash).forEach(function (d, i){
				var parent = {
											 x: endOfRow + clusterWidth - 32,
											 y: label_positions[d]
										 };

				sort_hash[d].forEach(function (id){
					var target = {
										y: currentOrder.indexOf(id)*h + 54,
										x: endOfRow
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

				clusterStrings.append("path")
					.classed("clusterStrings", true)
					.attr("d", "M"+startX+","+startY+","+stopX+","+stopY)
					.attr("style","stroke:black; opacity:0.2;");
			});

			var hit_box = heatmapClusters.each( function (d,i){
				if(sort_hash[d][0]) {
					var min = currentOrder.indexOf(sort_hash[d][0]),
							max = currentOrder.indexOf(sort_hash[d][sort_hash[d].length - 1]),
							height = ((1 + max - min) * h),
							y = heatmapOffsetTop+min*h,
							protein_hash = [];

					sort_hash[d].forEach(function (d, i){
						if (typeof protein_hash[minardo_data[d].h_name] === 'undefined'){
							protein_hash[minardo_data[d].h_name] = [];
						}
						protein_hash[minardo_data[d].h_name].push(minardo_data[d]);
					});

					var box = cluster_box.append("svg:g")
											.attr("class","hit_box")
											.attr("id", "hit_box_"+d);

					var cluster_outline = box.append("svg:rect")
						.classed("cluster_outline", true)
						.attr("id", "cluster_outline_"+d)
						.attr("width", rowWidth)
						.attr("height", height)
						.attr("fill", "rgba(0,0,0,0)")
						.attr("stroke-width", 1)
						.attr("stroke", "rgba(1,1,1,1)")
						.attr("stroke-opacity", 1)
						.attr("x",heatmapOffsetLeft)
						.attr("y",heatmapOffsetTop+min*h)
						.style("display","none")
						.on('mousedown', function(d,i) {
							unselect();
						});

				 var cluster_info = box.append("svg:g")
						.style("display","none")
						.classed("cluster_info",true);
				 
				 var cluster_rect = cluster_info.append("svg:rect")
						.attr("id", "cluster_info_"+d)
						.attr("width", rowWidth+30)
						.attr("height", height)
						.attr("fill", "#FFE53B")
						.attr("opacity", 0.8)
						.attr("x", endOfRow+clusterWidth+20)
						.attr("y", y);

					cluster_info.append("svg:text")
						.attr('x', endOfRow+clusterWidth+25)
						.attr('y', y + 2*h)
						.attr('class','cluster_info_text')
						.style('text-anchor','start')
						.style('font-size','12px')
						.text("Group - "+d);

					cluster_info.append("svg:text")
						.attr('x', endOfRow+clusterWidth+25)
						.attr('y', y + 4*h)
						.attr('class','cluster_info_text')
						.style('text-anchor','start')
						.style('font-size','10px')
						.text("Contains "+Object.keys(protein_hash).length+" proteins with "+sort_hash[d].length+" phosphorylation sites:");

				var yPosition = y + 6*h;
					Object.keys(protein_hash).forEach(function (protein, i){
						cluster_info.append("svg:text")
							.attr('x', endOfRow+clusterWidth+25)
							.attr('y', yPosition)
							.attr('class','cluster_info_text')
							.style('text-anchor','start')
							.style('font-size','8px')
							.text(protein);

						protein_hash[protein].forEach(function (spectra, i){
							cluster_info.append("svg:text")
								.attr('x', endOfRow+clusterWidth+25+60)
								.attr('y', yPosition)
								.attr('class','cluster_info_text')
								.style('text-anchor','start')
								.style('font-size','8px')
								.text(spectra.h_number);

							yPosition = yPosition + h;
						});
						yPosition = yPosition + h/2;
					});

					cluster_rect.attr("height", yPosition - y)

/*					sort_hash[d].forEach(function (row,i){
							cluster_info.append("svg:text")
								.attr('x', endOfRow+clusterWidth+25)
								.attr('y', y + i*h + h - 1)
								.attr('class','cluster_info_text')
								.style('text-anchor','start')
								.style('font-size','8px')
								.text(minardo_data[row].Protein_Names.split(";")[0]);

							console.log(row);
							console.log(i);
						});*/


					box.append("svg:rect")
						.attr("id",function(d){return "outline_"+d;})
						.attr("width", clusterWidth+20)
						.attr("height", height)
						.attr("fill", "rgba(0,0,0,0)")
						.attr("stroke-width", 1)
						.attr("stroke", "rgba(1,1,1,0)")
						.attr("stroke-opacity", 1)
						.attr("x", endOfRow)
						.attr("y", y)
						.on('mouseover', function(d,i) {
							if (!selected) {
								cluster_outline.style("display","");
								cluster_info.style("display","");
							}
						})
						.on('mouseout', function(d,i) {
							if (!selected) {
								d3.selectAll(".cluster_outline").style("display","none");
								d3.selectAll(".cluster_info").style("display","none");
							}
						})
						.on('mousedown', function(d,i) {
							if(!selected){
									selected = this;
									d3.selectAll(".selected").classed("selected", false);
									d3.select(this).classed("selected", true);
							} else {
								unselect();
//			d3.selectAll(".cluster_outline").style("display","none");
//			d3.selectAll(".cluster_info").style("display","none");
							}
						});
				}
			});
		}

  	function orderByResidueType(currentOrder){
  		sort_hash = {
  			"Serine": [],
  			"Threonine": [],
  			"Tyrosine":[]
  		};

			currentOrder.forEach(function (d,i){
				switch (minardo_data[d].Amino_Acid){
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
  		return sort_hash.Serine.concat(sort_hash.Threonine).concat(sort_hash.Tyrosine);
  	}

		function orderByCluster(oldOrder){
			var arrays = [];
			var newOrder = [];
			orderedClusters.forEach(function (d,i){
				arrays[d] = [];
			});
			oldOrder.forEach(function (id){
				arrays[clusters[id].cluster].push(id);
			});

			orderedClusters.forEach(function (d,i){
				newOrder = newOrder.concat(arrays[d]);
			});
			sort_hash = arrays;
    	return newOrder;
    }



		function orderByUniprot(oldOrder){
			uniprotHash = [];
			var newOrder = [];

			oldOrder.forEach(function (id){
				var uniprot = minardo_data[id].Uniprot.split(";")[0].substring(0,6);
				if (typeof uniprotHash[uniprot] === "undefined"){
					uniprotHash[uniprot] = [];
				}
				uniprotHash[uniprot].push(id);
			});

			Object.keys(uniprotHash).forEach(function (d,i){
				newOrder = newOrder.concat(uniprotHash[d]);
			});
			sort_hash = uniprotHash;
    	return newOrder;
    }



		function orderByFirstChange(oldOrder){
			var arrays = [];
			var newOrder = [];
			sort_hash = {};

			drawHeatmap(oldOrder);

			for(var i = 0; i < numberOfRows*2; i++){
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

			newOrder = newOrder.concat(downregulated);
			return newOrder;
		}


		function spectraHeatmap(){
			unselect();
			currentOrder = orderByResidueType(currentOrder);
			drawHeatmap(currentOrder);
			drawLabels();
		}

		function changeSort(){
			unselect();
			currentOrder = orderByFirstChange(currentOrder);
			drawHeatmap(currentOrder);
			drawLabels();
		}

		function clusterSort(){
			unselect();
			currentOrder = orderByCluster(currentOrder);
			drawHeatmap(currentOrder);
			drawLabels();
		}
		
		function uniprotSort(){
			unselect();
			currentOrder = orderByUniprot(currentOrder);
			drawHeatmap(currentOrder);
			drawLabels();
		}

		function drawHeatmap(order){
			//remove old stuff
			d3.select("#heatmap").remove();
			d3.select("#arrows").remove();
			d3.select("#cluster_box").remove();
			d3.select("#rowNames").remove();
		
			//draw rows
			buildHeatmap(order);
			//draw gene names
			buildGenenames();
			//draw arrows
			arrows = buildArrows();
			//mouse events
			buildMouseEvents();
		}

		function buildHeatmap(order){
			heatmap = MINARDO.hmh.SVG.append("g").attr("id", "heatmap").classed("svgButton", true);

			//make the rows
			heatmapRow = heatmap.selectAll(".row")
					.data(order)
				.enter().append("g")
					.classed("row", true)
					.each(function(d,i){
						d3.select(this).attr("id", "row_"+d);
					});

			order.forEach(function (row, rowNumber){
				var rowGroup = d3.select("#row_"+row);

				getData(row).forEach(function (column, columnNumber){
					rowGroup.append("svg:rect")
						.classed("rect",true)
						.attr('width',w)
						.attr('height',h)
						.attr('x', (columnNumber * w) + heatmapOffsetLeft)
						.attr('y', (rowNumber * h) + heatmapOffsetTop)
						.style('fill',function(d) {
							var value = minardo_data[d].time_course[columnNumber];
							var AA = minardo_data[d].Amino_Acid;
							if (AA == "S") {
								return colorScale_S(value);
							} else if (AA == "T") {
								return colorScale_T(value);
							} else if (AA == "Y"){
								return colorScale_Y(value);
							} else {
								console.log('problem with:');
								console.log(d);
							}
						});
				});
			});

		order.forEach(function (d,i){
			d3.select("#row_"+d).append("svg:rect")
				.classed("outline",true)
				.attr("id",function(d){return "outline_"+d;})
				.attr("width", rowWidth)
				.attr("height", h)
				.attr("fill", "rgba(0,0,0,0)")
				.attr("stroke-width", 1)
				.attr("stroke", "rgba(1,1,1,.2)")
				.attr("stroke-opacity", 1)
				.attr("x",heatmapOffset)
				.attr("y",50+i*h);
			});
		}

		function buildGenenames(){
			rowNames = MINARDO.hmh.SVG.append("svg:g").attr("id","rowNames");
		
			rowNames.append('svg:text')
					.attr('x', 65)
					.attr('y', 45)
					.attr('class','label')
					.attr("style", "font-size: 12px; text-anchor: end;")
					.text("Gene");

			rowNames.append('svg:text')
					.attr('x', 65+5)
					.attr('y', 45)
					.attr('class','label')
					.attr("style", "font-size: 8px; text-anchor: start;")
					.text("Residue");


			d3.selectAll(".row").each(function (d,i){
				var geneName = minardo_data[d].Gene_Names.split(";")[0],
						residue = minardo_data[d].h_number;
						hName = minardo_data[d].h_name;
						rowX = 65,
						rowY = 59 + i*h;
				rowNames.append('svg:text')
					.attr('x', rowX)
					.attr('y', rowY-1)
					.attr('class','label')
					.attr("style", "font-size: 8px; text-anchor: end;")
					.text(hName);

				rowNames.append('svg:text')
					.attr('x', rowX+5)
					.attr('y', rowY-1)
					.attr('class','label')
					.attr("style", "font-size: 8px; text-anchor: start;")
					.text(residue);

			});

		}

		function buildArrows(){
			arrows = MINARDO.hmh.SVG.append("svg:g").attr("id", "arrows");

			d3.selectAll(".row").data().forEach(function (row){
				var arrow_row = arrows.append("svg:g").attr("id", "arrows_"+row);

				var row_data = getData(row);
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

				arrow_row.data([{
					"upsA": upsA,
					"upsB": upsB,
					"downsA": downsA,
					"downsB": downsB,
					"ups": ups,
					"downs": downs,
					"changes": changes
				}]);

				changes.forEach(function (arrow,i){
					var this_arrow = null;
					if (arrow.before_or_after == "before") {
						this_arrow = makeArrow(heatmapOffset+w/4+(arrow.position*w) - 2, row, arrow.up_or_down, arrow_row);
					} else {
						this_arrow = makeArrow(heatmapOffset+(3*w)/4+(arrow.position*w) - 2, row, arrow.up_or_down, arrow_row);
					}
					if (i == 0){
						this_arrow.classed("firstArrow",true);
						if(firstArrowShow != "none") {
							this_arrow.style("display", firstArrowShow);
						}
					}
				});

			});
			return arrows;
		}

		function makeArrow(x, row, type){
			var opacity = 0.65;
			var y = 51 + currentOrder.indexOf(row)* h;

			var arrow = d3.select("#row_"+row).insert("svg:g",".outline").append("svg:g")
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
		}
		

		function getData(id){
			var place = 0;
			originalOrder.forEach(function(d,i){
				if (id == d){
					place = i;
				}
			});
			return minardo_data[id].time_course;
		}


		function buildButton(callback, text, w, h, x, y, class_value, group, rectId){
			var button = null;
			if (typeof group != 'undefined'){
			 button = group.append("svg:g").classed("svgButton",true);
			} else {
				button = MINARDO.hmh.SVG.append("svg:g").classed("svgButton",true);
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

		function showOnlyFirst(){
			if (firstArrowShow == "" && upshow == "none" && downshow == "none") {
				firstArrowShow = "none";
					d3.selectAll(".firstArrow").style("display", firstArrowShow);
					d3.selectAll(".up").style("display", upshow);
					d3.selectAll(".down").style("display", downshow);
			} else {
				// First turn off the arrows.
				upshow = "none";
				downshow = "none";
				d3.selectAll(".up").style("display", upshow);
				d3.selectAll(".down").style("display", downshow);
			
				firstArrowShow = "";
				d3.selectAll(".firstArrow").style("display", firstArrowShow);
			}
		}

		function toggleUp(){
			if(upshow == "none") {
				upshow = "";
				d3.selectAll(".up").style("display", upshow);
			}
			else {
				upshow = "none";
				d3.selectAll(".up").style("display", upshow);
			}
		}

		function toggleDown(){
			if(downshow == "none") {
				downshow = "";
				d3.selectAll(".down").style("display", downshow);
			}
			else {
				downshow = "none";
				d3.selectAll(".down").style("display", downshow);
			}
		}

		function unselect(){
			MINARDO.hmh.unselect();
		}
/*
d3.selectAll(".protein_bubble").each(function (d,i){
	var pos = $(this).position();
	pos.y = (pos.top-118)*(1683.779/882);
	pos.x = (pos.left-530)*(2381.103/1266);
//	console.log(pos);
	d3.select("#timepoints").append("svg:circle")
						.attr("cy", pos.y)
						.attr("cx", pos.x)
						.attr("r", 12)
						.classed("node", true);
	
	console.log(d3.select(this).attr("class"));
});
console.log("bookmark");
*/
		changeSort();
		spectraHeatmap();
		showOnlyFirst();