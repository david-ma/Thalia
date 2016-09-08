importScripts('/bower_components/sw-toolbox/sw-toolbox.js');
// By default, this does nothing.
toolbox.router.get('/challenges.html', toolbox.cacheFirst);
toolbox.router.get('js/*.js', toolbox.cacheFirst);
toolbox.router.get('css/*.css', toolbox.cacheFirst);
toolbox.router.get('*.html', toolbox.cacheFirst);
toolbox.router.get('images/*', toolbox.cacheFirst);
toolbox.router.get('bower_components/**/*', toolbox.cacheFirst);
toolbox.router.get('data/challenges.json', toolbox.cacheFirst);
toolbox.router.get('/(.*)', toolbox.cacheFirst, {origin: 'http://cdn-images.mailchimp.com'});
toolbox.router.get('/(.*)', toolbox.cacheFirst, {origin: 'http://s3.amazonaws.com'});
toolbox.router.get('/(.*)', toolbox.cacheFirst, {origin: 'https://www.google-analytics.com'});
// toolbox.precache(['/bower_components/polymer/polymer.html'])
