if ('registerElement' in document && 'createShadowRoot' in HTMLElement.prototype && 'import' in document.createElement('link') && 'content' in document.createElement('template')) {
// We're using a browser with native WC support!
} else {
	document.write('<script src="/bower_components/es6-shim/es6-shim.min.js"></script>');
	document.write('<script src="/bower_components/webcomponentsjs/webcomponents-lite.min.js"><\/script>');

}

if(!window.fetch) {
	document.write('<script src="/bower_components/fetch/fetch.js"></script>');
}
