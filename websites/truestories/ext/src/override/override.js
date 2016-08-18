
var imgs = [
"/img/1.jpg",
"/img/2.jpg",
"/img/3.jpg",
"/img/4.jpg",
"/img/5.jpg",
"/img/6.jpg"
]

if(localStorage.cache){
	myFunction(JSON.parse(localStorage.cache));
	refreshCache();
} else {
	var xmlhttp = new XMLHttpRequest();
	var url = "http://localstories.info/requestjson";

	xmlhttp.onreadystatechange = function() {
			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
					var myArr = JSON.parse(xmlhttp.responseText);
					myFunction(myArr);
			}
	}
	xmlhttp.open("GET", url, true);
	xmlhttp.send();
	
	console.log("wooo");
	refreshCache();
}


function refreshCache(){
	console.log("refreshing cache...");
	var xmlhttp = new XMLHttpRequest();
	var url = "http://localstories.info/requestjson";

	xmlhttp.onreadystatechange = function() {
			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
					var myArr = JSON.parse(xmlhttp.responseText);
					localStorage.cache = JSON.stringify(myArr);
					d3.select("body").append("img").attr({
						src: myArr.bestImage
					}).style({
						display: "none"
					})
			}
	}
	xmlhttp.open("GET", url, true);
	xmlhttp.send();

}




function myFunction(arr) {


d3.select("#background").style("background-image", "url("+arr["bestImage"]+")");
d3.select("#title").text(arr.Title);

// d3.select("#url").attr("href", arr.URL);
d3.select("#url").attr("href", "http://localstories.info/story/"+arr.row_names)


d3.select("#description").text(arr["Primary.image.caption"]);

var twittername = "abcnews";

if( arr.username != null) {
	twittername = arr.username;
}

d3.select("#twitterlink").attr("href", "http://twitter.com/"+twittername)

var rights = arr["Primary.image.rights.information"].split("|"),
		copyright = rights[0].split(":")[1].trim(),
		author = rights[2].split(":")[1].trim();

d3.select("#copyright").text(copyright);
d3.select("#author").text(author);


d3.select("#facebook").attr("href", "https://www.facebook.com/sharer/sharer.php?u=$"+arr.URL);
d3.select("#twitter").attr("href", "https://twitter.com/intent/tweet?text=via%20localstories.info%20%40"+twittername+"%20%23GovHack%20%23RealAusArt%20-%20"+arr.URL+" "+arr.Title);
d3.select("#pinterest").attr("href", "https://pinterest.com/pin/create/link/?url="+arr.URL);




}


function xmlToJson(xml) {
	// Create the return object
	var obj = {};
	
	if(!xml) {
		console.log("warning! No xml?");
	} else {

		if (xml.nodeType == 1) { // element
			// do attributes
			if (xml.attributes.length > 0) {
			obj["@attributes"] = {};
				for (var j = 0; j < xml.attributes.length; j++) {
					var attribute = xml.attributes.item(j);
					obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
				}
			}
		} else if (xml.nodeType == 3) { // text
			obj = xml.nodeValue;
		}

		// do children
		if (xml.hasChildNodes()) {
			for(var i = 0; i < xml.childNodes.length; i++) {
				var item = xml.childNodes.item(i);
				var nodeName = item.nodeName;
				if (typeof(obj[nodeName]) == "undefined") {
					obj[nodeName] = xmlToJson(item);
				} else {
					if (typeof(obj[nodeName].push) == "undefined") {
						var old = obj[nodeName];
						obj[nodeName] = [];
						obj[nodeName].push(old);
					}
					obj[nodeName].push(xmlToJson(item));
				}
			}
		}
	}

	return obj;
};

