
function infinite_scroll(callback) {

var _throttleTimer = null;
var _throttleDelay = 100;
var $window = $(window);
var $document = $(document);


	$window
		.off('scroll', ScrollHandler)
		.on('scroll', ScrollHandler);

	function ScrollHandler() {
		//throttle event:
		clearTimeout(_throttleTimer);
		_throttleTimer = setTimeout(function () {

			//do work
			if ($window.scrollTop() + $window.height() > getDocHeight() - 100) {
				callback();
			}

		}, _throttleDelay);
	}

	function getDocHeight() {
		var D = document;
		return Math.max(
				D.body.scrollHeight, D.documentElement.scrollHeight,
				D.body.offsetHeight, D.documentElement.offsetHeight,
				D.body.clientHeight, D.documentElement.clientHeight
		);
	}

}