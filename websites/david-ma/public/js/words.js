

var file = "words.txt";
		len = dictionary.length;


var randomWords = function(n) {
	if(!n){
		n = 1;
	}
	var words = "";
	for(var i = 0; i < n; i++) {
		words += dictionary[Math.floor(Math.random() * len)] + " ";
	}
	return words.trim();
}













