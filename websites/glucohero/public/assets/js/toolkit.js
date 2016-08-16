// David Ma's toolkit. Last updated... Jan 2015...

d0 = {
	"socket": io.connect(),
	"options": {
		"menuHeight": 200,
		"init": function(){},
		"keypress": {},
		"bindButtons": function(){
			d3.select("body").on("keydown", function(d){
//				console.log(d3.event.keyCode);
				if(typeof d0.options.keypress[d3.event.keyCode] != 'undefined'){
					d0.options.keypress[d3.event.keyCode]();
				}
			});
		}
	},
	"menu": {
		"init": function(name, buttons){
			Object.keys(buttons).forEach(function(button,i){
				d0.options.keypress[49+i] = buttons[button]
			});

			

			menu = d3.select("body").insert("div", ":first-child").attr({
				id: "menu",
				style: "position:fixed"//; display:none;"
			}).append("svg:svg").attr({
				id: "menuSVG",
				width: $("body").width(),
				height: 0
			}).append("svg:g").attr({
				transform: "matrix(1 0 0 1 0 -"+d0.options.menuHeight+")",
				id: "menugroup"
			});

			menu.append("svg:rect").attr({
				x: 0,
				y: 0,
				width: $("body").width(),
				height: d0.options.menuHeight,
				fill: "white",
				stroke: "black"
			});

			menu.append("svg:text").attr({
				x: 10,
				y: 35,
				style: "font-size:30"
			}).text(name);

			var tab = d3.select("body").insert("div", ":first-child").attr({
				style: "position:fixed"//; display:none;"
			}).append("svg:svg").attr({
				x:0,
				y:0,
				width:75,
				height:75
			}).append("svg:g").attr("transform", "matrix(1 0 0 1 -70 0) rotate(-45)")
			.on("click",toggleMenu);
			
			tab.append("svg:rect").attr({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				fill: "white",
				stroke: "black"
			});
			tab.append("svg:text").text("esc").attr({
				x: 50,
				y: 95,
				"text-anchor": "middle"
			}).style("font-size", 34);

			if(Object.keys(buttons).length == 0){
				tab.attr("display","none");
			}

			Object.keys(buttons).forEach(function(button, i){
				var b = menu.append("svg:g").attr("id", button).on("click", buttons[button]);

				b.append("svg:rect").attr({
					x: 10+120*i,
					y: 50,
					width: 100,
					height: 100,
					fill: "white",
					stroke: "black"
				});

				b.append("svg:text").attr({
					x: 15+120*i,
					y: 100,
					style: "font-size:30"
				}).text(button);
			});
			
			bio = menu.append("svg:g")
				.on("click",function(){window.open("mailto:da.ma@garvan.org.au")})
				.style("cursor","pointer");
				
			bio.append("svg:rect").attr({
				x: $("body").width()-160,
				y: 1,
				width: 159,
				height: 198,
				fill: "white",
				stroke: "black"
			});

			bio.append("svg:image").attr({
				"xlink:href": "images/david-sketch.jpg",
				x: $("body").width()-150,
				y: 10,
				width: 140,
				height: 140
			});
			bio.append("svg:text").attr({
				x: $("body").width()-150,
				y: 168,
				width: 140,
				height: 140
			}).style("font-size", 16)
			.text("Made by David Ma");
			bio.append("svg:text").attr({
				x: $("body").width()-150,
				y: 188,
				width: 140,
				height: 140
			}).style("font-size", 14)
			.text("da.ma@garvan.org.au");


			d0.options.keypress['27'] = toggleMenu;
			d0.options.bindButtons();

			var visible = false;
			function toggleMenu(){
				if(visible){
					visible = false;
					d3.select("#menuSVG").transition().attr("height", 0);
					d3.select("#menugroup").transition().attr("transform", "matrix(1 0 0 1 0 -"+d0.options.menuHeight+")");
				} else {
					visible = true;
					d3.select("#menuSVG").attr("height", d0.options.menuHeight);
					d3.select("#menugroup").transition().attr("transform", "matrix(1 0 0 1 0 0)");
				}
			}
		}
	},
	"label": {
		"init": function(vis, data){
		number = Object.keys(data).length;

label = d3.select("#page").append("svg:g").attr("id", "label").attr("transform","matrix(1 0 0 1 0 0)").attr("display", "none");

label.append("svg:rect")
	.attr({
		x: 0,
		y: 0,
		width: 100,
		height: 30 * number,
		fill: "white",
		stroke: "black"
	})

Object.keys(data).forEach(function(key, i){
	label.append("svg:text")
		.attr({
//			id: "labeltext-"+i,
			x: 10,
			y: 15+30*i
		}).text(key).style("font-size", 12);

	label.append("svg:text")
		.attr({
			id: "labeltext-"+i,
			x: 10,
			y: 25+30*i
		}).text("rofl").style("font-size", 12);
});
		},
		"mouse": {},
		"mouseenter": function(data){
			data.forEach(function(dat, i){
				d3.select("#labeltext-"+i).text(dat);
			});


			var mouse = d0.label.mouse,
					listener = function(){
						var e = d3.event
						mouse.x = e.pageX;//clientX;// || e.pageX;
						mouse.y = e.pageY;//clientY;// || e.pageY 
						mouse.x = mouse.x + 5;
						mouse.y = mouse.y + 5;
						update();
					};

			d3.select("body").on("mousemove", listener);

			d3.select("#label").attr("display", "");


			function update(){
				d3.select("#label").attr({
					transform: "matrix(1 0 0 1 "+mouse.x+" "+mouse.y+")"
				});
			}
		},
		"mouseout": function(){
			d3.select("body").on("mousemove", "");
//document.removeEventListener("mousemove", d0.label.listener, false);
			if(typeof d0.label.myTimeout != "undefined"){
				clearTimeout(d0.label.myTimeout);
			}
			d3.select("#label").attr("display", "none");
		},
		"update": function(m){
//		console.log("hey");
/*
			var x = $("#vis").offset().left,
					y =	$("#vis").offset().top;*/
			d3.select("#label").attr({
				display: "",
				transform: "matrix(1 0 0 1 "+m.x+" "+m.y+")"
			});
		}
	}
}
































































