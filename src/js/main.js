var Thalia = Thalia || {};

Thalia.module = function(config) {
	console.log("Adding Thalia module... "+config.name);
	this.config = config;

	var div = this.div = d3.select("#sidebar")
		.append("div")
		.classed("module", true)
		.attr("id", config.name);

	div.append("a").attr({
			href: "#"+config.name,
			class: "btn btn-default module-title"
		}).on("click", this.toggle)
			.datum(config)
			.classed("hidden", config.hidden)
			.append("h1")
			.html(config.title);


	switch(config.type) {
		case "table":
			var table = div.append("table").append("tbody");
			var tr = table.append("tr");
			if(config.header){
				config.header.forEach(function(d){
					tr.append("th").html(d);
				});
				config.data.forEach(function(row){
					tr = table.append("tr");
					row.forEach(function(cell){
						tr.append("td").html(cell);
					});
				});
			}
			
		break;
		default:
			var ul = this.ul = div.append("ul")
				.style({
					clip: "rect(0px, 1000px, 0px, 0px)"
				});

			if(config.data instanceof Array) {
				config.data.forEach(function(d){
					ul.append("li").html(d);
				});
			} else {
				Object.keys(config.data).forEach(function(key){
					ul.append("li").html(key+": "+config.data[key]);
				});
			}
	}

	var id = "#"+config.name;
	var height = $(id+" ul").height()+$(id).height()+20; // this +20 is needed because of something weird happening in hotfix.css please when hotfix.css is refactored

	if(d3.select(id).select("a").classed("hidden")) {
		d3.select(id).style("min-height", "0px");
		d3.select(id).select("ul").style("clip", "rect(0px, 1000px, 0px, 0px)");
	} else {
		d3.select(id).style("min-height", height+"px");
		d3.select(id).select("ul").style("clip", "rect(0px, 1000px, "+height+"px, 0px)");
	}	


};

Thalia.module.prototype.toggle = function(){
	$(this).toggleClass("hidden");
	var d = d3.select(this).datum(),
			id = "#"+d.name;
	
	var height = $(id+" ul").height()+$(id).height()+20; // this +20 is needed because of something weird happening in hotfix.css please when hotfix.css is refactored

	if(d3.select(id).select("a").classed("hidden")) {
		d3.select(id).style("min-height", "0px");
		d3.select(id).select("ul").style("clip", "rect(0px, 1000px, 0px, 0px)");
	} else {
		d3.select(id).style("min-height", height+"px");
		d3.select(id).select("ul").style("clip", "rect(0px, 1000px, "+height+"px, 0px)");
	}	
};



// Add hotkeys to any Thalia page.
// init is called once in layouts/main.gsp
// use Thalia.hotkeys.off(); to turn off the hotkeys on a page.
 Thalia.hotkeys = {
 	keys: {},
 	add: function(key, action){
 		this.keys[key] = action;
 	},
 	off: function(){
 		$('body').off("keydown");
 	},
 	init: function(){
 		var keys = this.keys;
		$('body').on("keydown", function(e){
			if(e && e.keyCode && keys[e.keyCode] && !$(document.activeElement).is("input") && !e.altKey && !e.metaKey && !e.ctrlKey){
					keys[e.keyCode]();
			}
		});
 	},
 	testMode: function(){
 		var keys = this.keys;
		$('body').on("keydown", function(e){
			if(e && e.keyCode && !$(document.activeElement).is("input") && !e.altKey && !e.metaKey && !e.ctrlKey){
					console.log("You pushed: "+e.keyCode);
				if (keys[e.keyCode]) {
					console.log("It has this function:");
					console.log(keys[e.keyCode]);
				}
			}
		}); 
 	}
 };
