# Thalia

Thalia is a nodejs server, which allows for simple serving of multiple websites from one instance.

This allows me to quickly create a new project folder and get to work. It contains a basic HTML5 boilerplate that sets you up with bootstrap, jquery, datatables & d3.js

The project folders can be git repos or shared with Dropbox if you're collaborating with less technical people. I often share these folders with friends who are learning to code so we have a shared workspace, or in hackathons when work needs to be synced across the team quickly and put online instantly

Quickstart
-
To install, download the repository then run:
```
npm install
bower install
gulp build
npm start
```

Note that ```npm start``` needs your admin password because it will start serving the website on port 80

Use gulp serve if you want to develop stuff.

If you want to start a new project, just copy the example folder and rename it. run ```gulp serve --site "folder_name"``` to start developing in that site. Note that running gulp will delete and rebuild the ```public``` folder from the ```src``` folder so I recommend only developing this way if all your developers know what the're doing. If it's just a simple Dropbox-shared project with a bunch of non-developers on your team, maybe stay away from using gulp.

Features
-
Besides simple serving of a public folder, **Thalia** can also do:

- **Redirects** (e.g. [david-ma.net/publications](http://david-ma.net/publications) redirects you to my google scholar page.)
- **Url Mapping** (e.g. [david-ma.net/hackers](http://david-ma.net/hackers) maps to the file hackers.txt)
- **Services and REST** (e.g. [david-ma.net/reddit/questions](http://david-ma.net/reddit/questions) runs a function which checks my database for the latest "Official Questions Thread" on [/r/photography](http://reddit.com/r/photography) and then you there. Services can also be used for REST interfaces, e.g. [localstories.info/requestjson](http://localstories.info/requestjson) pulls a random file as JSON from the [ABC Local archive](http://www.abc.net.au/local/about/?ref=footer), which was part of [a project](http://localstories.info/) I did for the [GovHack](http://govhack.org/) hackathon once upon a time.
- **Web Sockets** (Very good for sending data back and forth between pages without a page refresh. It's the new Ajax. If you want Ajax you can still do it on Thalia using the REST stuff mentioned above.)
- **Domains** (The same workspace can be served to as many different domains as you want. E.g. [localstories.info](http://localstories.info) and [localstories.com.au](http://localstories.com.au) both point at the same website)
- **Port fowarding** (e.g. [slack.redditphotography.com](http://slack.redditphotography.com) proxies to [redditphotography.com:3000](http://redditphotography.com:3000), allowing me to have different things running on the same machine.)

I should probably explain how to use those things, but I've written enough here and don't think anyone is going to read this anyway. If you want to know more about this ping me on Twitter asking for more documentation or raise a github issue.

-David [@Frostickle](https://twitter.com/frostickle)

Thanks
-

Thanks [@slavanossar](https://github.com/slavanossar/) for the [Thirst Quencher](https://github.com/slavanossar/thirst-quencher), from which my gulp script has been adapted!
