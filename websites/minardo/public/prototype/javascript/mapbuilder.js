var node_count = 0,
		positions = [],
		mapBuilder,
		buttonWidth = 200,
		buttonHeight = 30;

bound_circles = [];


function mapBuilderInit(){
	
	d3.select("#map").on("mousedown.builder", makeCircle);
	mapBuilder = d3.select("#vis")
		.append("svg:g")
			.attr("id", "mapBuilderGroup");



	var map = $("#map_group");
	mapX = 555;//parseInt(map.attr('x'));	
	mapY = 50;//parseInt(map.attr('y'));	

//	buildButton(locateProteins, "Locate Proteins", buttonWidth, buttonHeight, mapX, mapY - 40);
//	buildButton(activateMap, "Activate Map", buttonWidth, buttonHeight, mapX + 223, mapY - 40);
//	buildButton(activateSvgMap, "svg_map", buttonWidth, buttonHeight, mapX + 447, mapY - 40);

}

activated_map = false;
activated_svg_map = false;
var locatingProteins = false; // flag for the following function:
var protein_locate_counter = 0;
var this_row = null;
var uniprots = [];
var geneName = "nothing here, error";
function locateProteins(){
	activated_map = false;
	locatingProteins = true;
	orderByUniprot(currentOrder);

	uniprots = Object.keys(uniprotHash);
	this_row = uniprotHash[uniprots[protein_locate_counter]];
	geneName = idlookup[uniprotHash[uniprots[protein_locate_counter]][0]].Gene_Names;
	buildButton(null, geneName, buttonWidth*3, buttonHeight, mapX + 223, mapY - 40, "temp_1");
}
function buildBubble(vis, node){
	var circle = vis.append("svg:circle")
								.attr("id", node.id)
								.attr("cy", node.y)
								.attr("cx", node.x)
								.attr("r", 12)
								.classed("node", true)
								.data([node]);
	if(activated_map){
			circle.data()[0].rows.forEach(function (d,i){
				circle.classed("bound_to_"+d,true)
					.style("fill", "rgba(0,0,128,.7)")
					.attr("r", 0);
		});
	}

	if(locatingProteins){
		node.rows = this_row;
		this_row.forEach(function (d,i){
			circle.classed("bound_to_"+d,true);
		});
		protein_locate_counter++;
		uniprots = Object.keys(uniprotHash);
		this_row = uniprotHash[uniprots[protein_locate_counter]];
		geneName = idlookup[uniprotHash[uniprots[protein_locate_counter]][0]].Gene_Names;
		buildButton(null, geneName, buttonWidth*3, buttonHeight, mapX + 223, mapY - 40, "temp_1");
	}
}


function makeCircle(){
	if(!activated_map){
		if(d3.event.button == 0){     // not sure if i should make it ==0 or just !=2
			var node = {
									 x: d3.event.offsetX,
									 y: d3.event.offsetY,
									 id: 'node_'+node_count++
								 }
			positions.push(node);
		buildBubble(d3.select("#vis"), node);
		}
  }
}

function activateMap(){
	activated_map = true;
	circle_data.forEach(function(node){
		buildBubble(d3.select("#vis"), node);
	});
}




function clearPositions(){
	positions = [];
}

function printJSON(){
	console.log(JSON.stringify(positions, null, "\t"));
}































