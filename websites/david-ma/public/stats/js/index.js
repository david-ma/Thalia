var tags = null;
var d3mess = true;

$(document).ready(function(){
	var socket = io.connect();

$('body').keyup(function (e) {
  e.preventDefault();

  if (e.keyCode == 13) { // enter
    searchSubmit(socket);
  } else if (e.keyCode == 37){ //left arrow
  	if (zoomed_photo != null){
  		lightboxScroll("left");
  	}
  } else if (e.keyCode == 38){ //up 
  	if (zoomed_photo != null){
  		lightboxScroll("up");
  	}
  } else if (e.keyCode == 39){ //right arrow
  	if (zoomed_photo != null){
  		lightboxScroll("right");
  	}
  } else if (e.keyCode == 40){ //down
  	if (zoomed_photo != null){
  		lightboxScroll("down");
  	}
  } else if (e.keyCode == 27){ //escape
  	if (zoomed_photo != null){
  		unzoom();
  	}
  }
});

	socket.on('searchReturn',function(d){
		if(typeof d.album != 'undefined') {
			if (window.location.pathname.slice(0,8) != '/albums/' ) {
				window.history.pushState({},"", "albums/"+d.albumname);
			} else if (window.location.pathname.slice(0,8+d.albumname.length) != '/albums/'+d.albumname ) {
				window.history.pushState({},"", d.albumname);
			}
			drawAlbum(d);
		} else {
//			console.log(tags);
			if (Object.keys(tags).indexOf($('#search').val()) < 0) {
				$('#search').attr("placeholder", "Try something else...").val("");
			}
		}
	});

	socket.on('availableTags', function(d){
		tags = d;
		$( "#search" ).autocomplete({
			source: Object.keys(tags)
		});
	});
});

function checkTags(callback){
//	console.log('checking tags');
	var socket = io.connect();
	
	socket.on('availableTags', function(d){
		tags = d;
		$( "#search" ).autocomplete({
			source: Object.keys(tags)
		});
		callback();
	});
}

function searchSubmit(socket){
	var q = document.getElementById("search").value; //q for query
//	alert(q+' was searched');
	
	var url=window.location.href;

	var qs=q.toLowerCase().trim(); //sanitised query

	var queryList=qs.split(' ');

	
//	console.log(tags);
	if(tags){
		if(typeof tags[q] != 'undefined'){
			socket.emit('query',{'query':q});
			url = tags[q];
		} else {
			// send query
			socket.emit('query',{'query':q});
		}
	} else {
		console.log("tags not loaded");
	}

	if(url != window.location.href){
		window.location.href = url;
	} else {
		if(!d3mess) {
			$('#search').attr("placeholder", "Try again").val("");
		}
	}
}

function drawAlbum(data){
	$("#photoLayer").remove();
//	console.log(data);
	albumBlob = {
		name: data.albumname,
		list: data.album,
		xNum: 0,
		yNum: 0,
		bs: 200, // box size
		gap: 30
	}
//	console.log('drawing album');
	var w = $('body').width() - 50;
	
	if($("#fader").length == 0){ //only add the fader once?
		d3.select("body").insert("div", "div")
			.attr("id","fader").classed("fader", true)
			.style("opacity", 0).transition().style("opacity", 0.85);
	}

	$("#search").val("").attr("placeholder","Go to...");
	
	d3.select("#searchDiv").transition().duration(1000)
		.style("margin", '25px auto 0px')
		.style("width", w+'px');
		
	vis = d3.select("#vis").style("margin", '29px auto 0px')
		.append("svg:svg")
		.attr("id", "photoLayer")
		.attr("width", w)
		.attr("height", 2500);

	data.album.forEach(function(photo){
		addPhoto(vis, photo, albumBlob);
	});
	
	d3.select("#photoLayer").style("height","");
}

function addPhoto(vis, photo, albumBlob){
	var photoid = "photo_"+albumBlob.name+"_"+albumBlob.list.indexOf(photo);
	var width = $('#vis').width();
	box = vis.append("svg:g")
	.attr("id", photoid)
	.on("click",function(){
		startLightbox(vis, photo, albumBlob, photoid, d3.event);
	});

	var image = box.append("svg:image")
		.attr("id", photo)
		.attr("xlink:href", "/albums/"+albumBlob.name+"/"+photo)
		.attr("height", albumBlob.bs)
		.attr("width", albumBlob.bs)
		.attr("x", albumBlob.xNum)
		.attr("y", 1500 + albumBlob.yNum); //previously was $('html').height()

	
	var newY = albumBlob.yNum;

	var _img = document.getElementById(photo);
	var newImg = new Image;
		newImg.src = "/albums/"+albumBlob.name+"/"+photo;
		newImg.onload = function(){
			_img.src = this.src;
//			console.log("lol");
			image.transition().delay(newY+((100+albumBlob.xNum)/5)).duration(1000)
		.attr("y", newY);
		}



/*
	var image = $("#photoid").append("svg:image")
		.attr("xlink:href", "/albums/"+albumBlob.name+"/"+photo)
		.attr("height", albumBlob.bs)
		.attr("width", albumBlob.bs)
		.attr("x", albumBlob.xNum)
		.attr("y", 1500); //previously was $('html').height()


//			.transition().delay(albumBlob.yNum+((100+albumBlob.xNum)/5)).duration(1000)
//		.attr("y", albumBlob.yNum);
*/



	albumBlob.xNum += albumBlob.bs + albumBlob.gap;
	if (albumBlob.xNum < (width)) {
	} else {
		albumBlob.xNum = 0;
		albumBlob.yNum += albumBlob.bs + albumBlob.gap;
	}
	$('#vis svg').height(albumBlob.yNum + 250)
	.width(Math.floor(width/(albumBlob.bs+albumBlob.gap))*(albumBlob.bs+albumBlob.gap));
	$('#vis').width(Math.floor(width/(albumBlob.bs+albumBlob.gap))*(albumBlob.bs+albumBlob.gap));
//	d3.select('#vis svg').style("margin", "auto");
	d3.select("#photoLayer").attr("height", albumBlob.yNum + 250);
}

function startLightbox(vis, photo, blob, photoid, event){
	/*
	d3.select("body").insert("div", "div").attr("id", "lightbox")
	
	d3.select("body").insert("div", "div")
		.attr("id","lightbox_fader").classed("fader", true)
		.style("opacity", 0).style("z-index", 0) //correct z-index?
		.transition().style("opacity", 0.85);
	*/


	if (zoomed_photo == null) {
		vis.append("svg:g")
			.on("click", function(){
				unzoom();
			})
			.attr("id", "svg_fader")
		.append("svg:rect")
			.attr("fill", "#26292E")
			.style("opacity", 0.8)
			.attr("width", $("#photoLayer").width())
			.attr("height", $("#photoLayer").height());

		lightboxZoom(vis, photoid, blob);
	}
}

var zoomed_photo = null;

function lightboxZoom(vis, photoid, blob){
	$("#svg_fader").after($("#"+photoid));
	var pic = d3.select("#"+photoid+" image");
	var group = d3.select("#"+photoid);

	var size = ($(window).width() < $(window).height()) ?
							$(window).width() : $(window).height();

	zoomed_photo = {
		'vis': vis,
		'photoid': photoid,
		'x': pic.attr("x"),
		'y': pic.attr("y"),
		'size': pic.attr("height"),
		'pic': pic,
		'blob': blob
	};

	pic
		.classed("lightboxZoomed", true)
		.transition().duration(800)
		.attr("x", (($("#vis").width() - (size*.85))/2))
		.attr("y", size * .05 + $(window)[0].scrollY)
		.attr("height", size * .85)
		.attr("width", size * .85);
}

function unzoom(scroll){
	if (zoomed_photo != null) {
		if(!scroll) {
			d3.select("#svg_fader").remove();
		}
		zoomed_photo.pic
			.classed("lightboxZoomed", false)
			.transition()
			.attr("x", zoomed_photo.x)
			.attr("y", zoomed_photo.y)
			.attr("height", zoomed_photo.size)
			.attr("width", zoomed_photo.size);
		$("#"+zoomed_photo.photoid).after($("#svg_fader"));
		zoomed_photo = null;
	}
}

function lightboxScroll(dir){ //direction
	var vis = zoomed_photo.vis;
	var regex = /^(.*_)(\d*)$/;
	var thing = regex.exec(zoomed_photo.photoid);
	console.log(thing);
	console.log(zoomed_photo.photoid);
	var next_photoid = null;
	var blob = zoomed_photo.blob

	var cols = Math.floor($("#vis").width()/(blob.bs + blob.gap));
	console.log(cols);

	if(dir == "left"){
		thing[2]--;
	} else if (dir == "right"){
		thing[2]++;
	} else if (dir == "up"){
		window.scrollTo(0, window.scrollY-200);
		thing[2] = parseInt(thing[2]) - cols;
	} else if (dir == "down") {
		window.scrollTo(0, window.scrollY+200);
		thing[2] = parseInt(thing[2]) + cols;
	}

	if (thing[2] < 0) {
	 unzoom();
	} else if (thing[2] >= blob.list.length) {
	 unzoom();
	} else {
		unzoom("Scrolling");
		lightboxZoom(vis, thing[1] + thing[2], blob);
	}
}


function isPhoto(file){
	var result = false;
	var end = file.substring(file.lastIndexOf('.'),file.length).toLowerCase();

	if (end == '.jpg' ||
			end == '.jpeg' ||
			end == '.png' ||
			end == '.gif' ||
			end == '.bmp') {
		result = true;
	}
	
	return result;
}

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-49861162-1', 'david-ma.net');
ga('require', 'displayfeatures');
ga('send', 'pageview');




















































