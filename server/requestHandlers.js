const db = require("./database").db;
const fs = require('fs');
const fsPromise = fs.promises;
const mustache = require('mustache');

const Website = function (site, config) {
    if(typeof config === "object") {
        this.data = false ;
        this.dist = false ;
        this.cache = typeof config.cache === "boolean" ? config.cache : true;
        this.folder = typeof config.folder === "string" ? config.folder : "websites/"+site+"/public";
        this.domains = typeof config.domains === "object" ? config.domains : [];
        this.pages = typeof config.pages === "object" ? config.pages : {};
        this.redirects = typeof config.redirects === "object" ? config.redirects : {};
        this.services = typeof config.services === "object" ? config.services : {};
        this.controller = typeof config.controller === "object" ? config.controller : {};
        this.proxies = typeof config.proxies === "object" ? config.proxies : {};this.security = typeof config.security === "object" ? config.security : {loginNeeded:function(){return false;}};
        this.viewableFolders = config.viewableFolders || false;
    } else {
        console.log("Config isn't an object");
    }
};

const handle = {
    websites: {},
    index: {localhost: 'default'},
    loadAllWebsites: function (){
        let developing = "";
        const pattern = /^\d{0,5}$/;

        // To do: we should check that the workspace exists, otherwise leave it as default
        if (process.argv[2] !== null && process.argv[2] !== undefined && !pattern.exec(process.argv[2])) {
            developing = process.argv[2];
        } else if(typeof process.argv[3] !== null && process.argv[3] !== undefined && !pattern.exec(process.argv[3])){
            developing = process.argv[3];
        }

        if(developing) {
            console.log("Only load %s", developing);
            var site = developing;
            console.log("Adding site: "+site);
            var config, cred;
            try {
                const start = Date.now();
                config = require('../websites/'+site+'/config').config;
                console.log(`${Date.now() - start} ms - config.js for ${site}`);
            } catch (err){
                if(err.code !== 'MODULE_NOT_FOUND') {
                    console.log("Warning, your config script for "+site+" is broken!");
                    console.log();
                } else {
                    console.log(`Error in ${site} config!`);
                    console.log(err);
                }
            }
            try {
                cred = JSON.parse(fs.readFileSync('websites/'+site+'/cred.json'));
            } catch (err){}
            config.cache = false;
            handle.addWebsite(site, config, cred);
        } else {
            fs.readdirSync('websites/').forEach(function(site){
                if(fs.lstatSync('websites/'+site).isDirectory()) {
                    console.log("Adding site: "+site);
                    var config, cred;
                    try {
                        config = require('../websites/'+site+'/config').config;
                    } catch (err){
                        if(err.code !== 'MODULE_NOT_FOUND') {
                            console.log("Warning, your config script for "+site+" is broken!");
                            console.log();
                        }
                    }
                    try {
                        cred = JSON.parse(fs.readFileSync('websites/'+site+'/cred.json'));
                    } catch (err){}
                    handle.addWebsite(site, config, cred);
                }
            });
        }
    },

    // TODO: Make all of this asynchronous?
    // Add a site to the handle
    addWebsite: function(site, config, cred){
        config = config || {};
        handle.websites[site] = new Website(site, config);

        // If dist or data exist, enable them.
        if(fs.existsSync(`websites/${site}/data`)) {
            handle.websites[site].data = "websites/"+site+"/data";
        }
        if(fs.existsSync(`websites/${site}/dist`)) {
            handle.websites[site].dist = "websites/"+site+"/dist";
        }

        Object.keys(handle.websites[site].proxies).forEach(function(proxy){
            handle.proxies[proxy] = handle.websites[site].proxies[proxy];
        });

        // Add the site to the index
        handle.index[site+".david-ma.net"] = site;
        handle.websites[site].domains.forEach(function(domain){
            handle.index[domain] = site;
        });

        // If DB credentials are provided, connect to the db and add to the site handle
        if(cred) {
            handle.websites[site].db = new db(cred);
        }

        // If sequelize is set up, add it.
        if(fs.existsSync(`websites/${site}/db_bootstrap.js`)) {
            try {
                const start = Date.now();
                handle.websites[site].seq = require(`../websites/${site}/db_bootstrap.js`).seq;
                console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`);
            } catch(e) {
                console.log(e);
            }
        }

        // If website has views, load them.
        if(fs.existsSync(`websites/${site}/views`)) {
            readAllViews(`${__dirname}/../websites/${site}/views`).then(views => {
                handle.websites[site].views = views;

                fsPromise.readdir(`websites/${site}/views`)
                .then(function(d){
                    d.filter(d => d.indexOf('.mustache') > 0).forEach(file => {
                        const webpage = file.split('.mustache')[0];
                        if((config.mustacheIgnore ? config.mustacheIgnore.indexOf(webpage) == -1 : true) &&
                            !handle.websites[site].controller[webpage]
                        ) {
                            handle.websites[site].controller[webpage] = function(router) {
                                if(handle.websites[site].cache) {
                                    router.res.end(mustache.render(views[webpage], {}, views));
                                } else {
                                    readAllViews(`${__dirname}/../websites/${site}/views`).then(views => {
                                        handle.websites[site].views = views;
                                        router.res.end(mustache.render(views[webpage], {}, views));
                                    });
                                }
                            }
                        }
                    });
                }).catch(e => console.log(e));
            });
        }

        // If the site has any startup actions, do them
        if(config.startup){
            config.startup.forEach(function(action){
                action(handle.websites[site]);
            });
        }
    },
    getWebsite: function(domain){
        var site = handle.index.localhost;
        if(domain) {
            if(handle.index.hasOwnProperty(domain)) {
                site = handle.index[domain];
            }
            domain = domain.replace("www.","");
            if(handle.index.hasOwnProperty(domain)) {
                site = handle.index[domain];
            }
        }
        return handle.websites[site];
    },
    proxies: {}
};

handle.addWebsite("default", {});

async function readAllViews(folder) {
    return new Promise((finish, reject) => {
        fsPromise.readdir(folder).then( (directory) => {
            Promise.all(directory.map(filename => new Promise((resolve, reject) =>{
                if(filename.indexOf(".mustache") > 0) {                
                    fsPromise.readFile(`${folder}/${filename}`, 'utf8')
                        .then(file => {
                            const name = filename.split('.mustache')[0];
                            resolve({
                                [name]: file
                            })
                        }).catch(e => console.log(e));
                } else {
                    fsPromise.lstat(`${folder}/${filename}`).then(d => {
                        if(d.isDirectory()) {
                            readAllViews(`${folder}/${filename}`)
                            .then(d => resolve(d));
                        } else {
                            // console.log(`${filename} is not a folder`);
                            resolve({});
                        }
                    })
                }
            }))).then((array) => {
                finish(array.reduce((a, b) => Object.assign(a, b)))
            });
        }).catch(e => console.log(e));
    })
}

exports.handle = handle;


































































