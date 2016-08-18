# True Stories

Created for Australia's [GovHack] 2015 by team [Potato Heads]. A hackathon based on [OKFA] (Open Knowledge Foundation Australia)'s publicly available datasets, released by the Australian Government.

To "promote viewership" of the 8500+ photo stories in the [ABC Local Stories archive], we create a [Google Chrome Extension] which changes gives you a new story every time you open a tab. We believe that this is a very fun, friendly and non-intrusive way to add a bit of ABC local to your life.

It doesn't get in your way, but if you see something interesting, there are links to dive deeper into the archive and find out more about the story that you're looking at!

We've enriched the data with ABS data about the local area and shown it on a map on our website as well, allowing you explore Australia!

See more info on our [website] or our GovHack [hackerspace]. Or just go ahead and download the [Google Chrome Extension]!

# Future Work
We would like to make an Android version of this app by extending this code: https://github.com/cricklet/Auto-Wallpaper-for-reddit-

# Version
0.0.6

# Tech
True Stories uses:

* [node.js] - evented I/O for the backend
* [Twitter Bootstrap] - great UI boilerplate for modern web apps
* [d3.js]
* [jQuery] - duh

The Potato Heads used a number of tools to help organise their team (this is an unnecessary list, but might be helpful info for other hackers out there!):
* [Dropbox]
* [Slack]
* [Google Docs]

...I'll fill out this section later sorry...

# Team Potato Heads
(No particular order - we all worked hard on this)
* [@Certifiedwaif] - Mark Greenaway - Data Scientist
* [@Zazuazad] - Zaara Azad - Data Scientist
* [@Frostickle] - David Ma - Developer
* [@Aeromental] - Daniel Sempértegui - Designer
* [@StringStory] - Suzie Nguyen - Storyteller

### Installation

Just download it from the [Chrome Web Store]!

# Folder Structure:

* data: Data and scripts used by the system
* ext: The Google Chrome Extension folder. This is 99% boilerplate. The only files of interest are in: ext/src/override, these files describe the webpage that override the new tabs.
* gh2015: Initial prototype. Now defunct
* website: This folder contains the node.js server and public folder for the app, since the app needs to request data from our database and serve a few webpages.


License
----

MIT? I think this is right. Please don't hold me to this just yet.

### Todo's

* Fill out the rest of this readme...
* Find out what License this stuff should be listed as...

[@Aeromental]: http://twitter.com/aeromental
[@StringStory]: http://twitter.com/stringstory
[@Zazuazad]: http://twitter.com/zazuazad
[@Certifiedwaif]: http://twitter.com/certifiedwaif
[@Frostickle]: http://twitter.com/frostickle
[Chrome Web Store]: https://chrome.google.com/webstore/detail/true-stories/cemjfombkpblppjbaepfldgmnhfjpmjh
[Google Chrome Extension]: https://chrome.google.com/webstore/detail/true-stories/cemjfombkpblppjbaepfldgmnhfjpmjh
[ABC Local Stories archive]: https://data.gov.au/dataset/abc-local-online-photo-stories-2009-2014
[OKFA]: http://au.okfn.org/
[GovHack]: http://govhack.org
[hackerspace]: http://hackerspace.govhack.org/content/true-stories
[website]: http://localstories.com.au
[Potato Heads]: http://hackerspace.govhack.org/content/true-stories
[node.js]:http://nodejs.org
[jQuery]:http://jquery.com
[Twitter Bootstrap]:http://twitter.github.com/bootstrap/
