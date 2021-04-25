# Thalia

Thalia is a nodejs server, which allows for simple serving of multiple websites from one instance.

This allows me to quickly create a new project folder and get to work. It contains a basic HTML5 boilerplate that sets you up with bootstrap, jquery, datatables & d3.js

The project folders can be git repos or shared with Dropbox if you're collaborating with less technical people. I often share these folders with friends who are learning to code so we have a shared workspace, or in hackathons when work needs to be synced across the team quickly and put online instantly.

Quickstart
-
To install, download the repository then run:
```
yarn install
yarn gulp build
yarn start
```

Note that ```npm start``` needs your admin password because it will start serving the website on port 80

Use gulp serve if you want to develop stuff.

If you want to start a new project, just copy the example folder and rename it. run ```gulp serve --site "folder_name"``` to start developing in that site. Note that running gulp will delete and rebuild the ```public``` folder from the ```src``` folder so I recommend only developing this way if all your developers know what the're doing. If it's just a simple Dropbox-shared project with a bunch of non-developers on your team, maybe stay away from using gulp.

To test, run:
```
yarn test
```

To develop, run:
```
./develop.sh example
```
This will tell gulp to watch a single folder: websites/example/src, outputting anything you write to websites/example/public, and serving it using Thalia on port 1337, and using browsersync on port 3000.

Features
-
Besides simple serving of a public folder, **Thalia** can also do:
- **Redirects** (e.g. [david-ma.net/publications](https://david-ma.net/publications) redirects you to my google scholar page.)
- **Url Mapping** (e.g. [david-ma.net/hackers](https://david-ma.net/hackers) maps to the file hackers.txt)
- **Services and REST** (e.g. [david-ma.net/reddit/questions](https://david-ma.net/reddit/questions) runs a function which checks my database for the latest "Official Questions Thread" on [/r/photography](https://reddit.com/r/photography) and then you there. Services can also be used for REST interfaces, e.g. [localstories.info/requestjson](https://localstories.info/requestjson) pulls a random file as JSON from the [ABC Local archive](https://www.abc.net.au/local/about/?ref=footer), which was part of [a project](https://localstories.info/) I did for the [GovHack](https://govhack.org/) hackathon once upon a time.
- **Domains** (The same workspace can be served to as many different domains as you want. E.g. [localstories.info](https://localstories.info) and [truestories.david-ma.net](https://truestories.david-ma.net) both point at the same website)
- **Reverse Proxy** (e.g. [slack.redditphotography.com](http://slack.redditphotography.com) proxies to [redditphotography.com:3000](http://redditphotography.david-ma.net:3000/), allowing me to have different things running on the same machine.), Proxies can also be filtered so only certain subdirectories are proxied. This is especially useful in conjunction with Tomcat web applications.
- **Data** Files that don't belong in the codebase can be added to /data/ so they don't need to be commited or watched. Just set ```data: true`` in config.js and Thalia will serve files from that folder as if they were in public/data.
- Supports databases using [Sequelize ORM](https://sequelize.org/).
- ~~**SSL** Use Let's Encrypt to secure your websites.~~ Nevermind. This was too much work for not much benifit. [Just use an nginx reverse proxy or something](https://www.digitalocean.com/community/tutorials/how-to-configure-nginx-with-ssl-as-a-reverse-proxy-for-jenkins).

I should probably explain how to use those things, but I've written enough here and don't think anyone is going to read this anyway. If you want to know more about this ping me on Twitter asking for more documentation or raise a github issue.

-David [@Frostickle](https://twitter.com/frostickle)

To do:
- Add more tests
- Write an init script to start a new project

Thanks
-

Thanks [@cferdinandi](https://github.com/cferdinandi/) for [Gulp Boilerplate](https://github.com/cferdinandi/gulp-boilerplate), from which my gulp script for v3 was adapted.

Thanks [@slavanossar](https://github.com/slavanossar/) for [Thirst Quencher](https://github.com/slavanossar/thirst-quencher), from which my gulp script for v2 was adapted.
