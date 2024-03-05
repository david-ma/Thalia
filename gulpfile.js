var fs = require('fs');
var readlineSync = require('readline-sync');
var argv = require('yargs').argv;

var websites = fs.readdirSync('./websites').filter( site => site.indexOf(".") == -1 ); // Websites available

var site = null; // Name of the website
var workspace = null; // Folder of the workspace
var jsTasks = null; // Repeated JavaScript tasks
var paths = null; // Paths related to workspace


/**
 * Gulp Packages
 */


// General
var {src, dest, watch, series, parallel} = require('gulp');
var del = require('del');
var flatmap = require('gulp-flatmap');
var lazypipe = require('lazypipe');
var rename = require('gulp-rename');
var package = require('./package.json');

// Scripts
var concat = require('gulp-concat');
var uglify = require('gulp-terser');

// Styles
var sass = require('gulp-sass')(require('sass'));
var postcss = require('gulp-postcss');
var prefix = require('autoprefixer');
var cssnano = require('cssnano');


// BrowserSync
var browserSync = require('browser-sync');

const staticSrc = ".+(html|txt|min.js|min.js.map|min.css.map|eot|ttf|woff|woff2|otf|json|pdf|ico|xml|js|css|csv|tsv|png|jpg|jpeg)";


/**
 * Gulp Tasks
 */
 
function compileBoilerplate(done){

    paths = {
        input: 'src/',
        output: workspace+'/dist/',
        scripts: {
            input: 'src/**/*(?<!\.min)\.js',
            output: workspace+'/dist/'
        },
        styles: {
            input: 'src/**/*.+(scss|sass)',
            output: workspace+'/dist/'
        },
        copy: {
            input: 'src/**/*'+staticSrc,
            output: workspace+'/dist/'
        },
        views: workspace+'/views/**/*.(mustache|hbs)',
        scaffold: 'src/views/**/*',
        reload: './'+workspace+'/dist/'
    };

    jsTasks = lazypipe()
        .pipe(dest, paths.scripts.output)
        .pipe(rename, {suffix: '.min'})
        .pipe(uglify)
        .pipe(dest, paths.scripts.output);

    parallelBuildTasks(done);
}

var siteConfig = null;

function setSite(website){
    site = website;
    workspace = "websites/"+site;
    console.log(`Setting workspace to: ${workspace}`);

    // This might be to be too slow. Don't use it.
    // if(fs.existsSync(`${__dirname}/websites/${site}/config.js`)) {
    //     siteConfig = require(`${__dirname}/websites/${site}/config`).config;
    // } else {
    //     siteConfig = require(`${__dirname}/websites/${site}/config/config`).config;
    // }

    /**
     * Paths to project folders
     */

    paths = {
        input: workspace+'/src/',
        output: workspace+'/dist/',
        scripts: {
            input: workspace+'/src/**/*(?<!\.min)\.js',
            output: workspace+'/dist/'
        },
        styles: {
            input: workspace+'/src/**/*.+(scss|sass)',
            output: workspace+'/dist/'
        },
        copy: {
            input: workspace+'/src/**/*'+staticSrc,
            output: workspace+'/dist/'
        },
        views: workspace+'/views/**/*.(mustache|hbs)',
        scaffold: 'src/views/**/*',
        public: workspace+'/public',
        docs: workspace+'/docs', // Github pages uses /docs instead of /public
        reload: './'+workspace+'/dist/'
    };

    console.log("hey we're here, no problems")

    jsTasks = lazypipe()
        .pipe(dest, paths.scripts.output)
        .pipe(rename, {suffix: '.min'})
        .pipe(uglify)
        .pipe(dest, paths.scripts.output);
}

var getWorkEnv = function (done) {
    console.log("Getting work env!!!!")
    console.log("Site:", site)
    if (site) {
        setSite(site);
        done();
    } else {

        if (argv.s === true || argv.site === true) {
            console.log("When using -s or --site, you must specify which site you're using.");
            process.exit(1);
        } else if (argv.s || argv.site) {
            site = argv.s || argv.site;
            if ( websites.indexOf(site) == -1 ) {
                console.log(`Website '${site}' does not exist.`);
                console.log("Please use one of the following: " + websites.join(", "));
                process.exit(1);
            }
        } else {
            site = promptForSite();
        }

        console.log("Found the site:", site)

        setSite(site);
        done();
    }
}



var promptForSite = function () {
    websites = fs.readdirSync('./websites');
    websites = websites.filter( site => site.indexOf(".") == -1 );

    console.log("Here are the websites:");
    websites.forEach(function(site, i){
        console.log(`${i}) ${site}`);
    });

    site = readlineSync.question('Which site do you want to work on? ');

    if (websites.indexOf(site) >= 0) {

    } else if (websites[site] != undefined) {
        site = websites[site];
    } else {
        site = 'default';
    }

    return site;
}




// Remove pre-existing content from output folders
var cleanDist = function (done) {
	// Clean the dist folder
	del.sync([
		paths.output
	]);

	// Signal completion
	done();
};



// Lint, minify, and concatenate scripts
var buildScripts = function (done) {
	// Run tasks on script files
	return src(paths.scripts.input)
		.pipe(flatmap(function(stream, file) {

			// If the file is a directory
			if (file.isDirectory()) {

				// Grab all files and concatenate them
                src(file.path + '/*.js')
					.pipe(concat(file.relative + '.js'))
					.pipe(jsTasks());

				return stream;
			}

			// Otherwise, process the file
			return stream.pipe(jsTasks());

		}));
};


// Process, lint, and minify Sass files
var buildStyles = function (done) {
    console.log("Running gulp task buildStyles");

    var scssLoadPaths = [
            'src/css/vendor/bootstrap',
            'src/css/vendor/bootstrap/mixins',
            'src/css/vendor',
            'src/css'
        ];

	// Run tasks on all Sass files
	return src(paths.styles.input)
		.pipe(sass({
    		includePaths: scssLoadPaths,
			outputStyle: 'expanded',
			sourceComments: true
		}))
		.pipe(postcss([
			prefix({
				cascade: true,
				remove: true
			})
		]))
		.pipe(dest(paths.styles.output))
		.pipe(rename({suffix: '.min'}))
		.pipe(postcss([
			cssnano({
				discardComments: {
					removeAll: true
				}
			})
		]))
		.pipe(dest(paths.styles.output));

};




// Copy static files into output folder
var copyFiles = function (done) {
    console.log("Copying files...");
	// Copy static files
	return src(paths.copy.input)
		.pipe(dest(paths.copy.output));
};

// Watch for changes to the src directory
var startBrowserSync = function (done) {
	// Initialize BrowserSync
    var bs = {
		server: {
			baseDir: paths.reload
		}
	}

    // Use option t for Thalia, if we're running that server
    if(argv.t) {
        bs = {
            proxy: "localhost:1337",
            ghostMode: false
        };
    }

    browserSync.init(bs);

	// Signal completion
	done();
};

// Reload the browser when files change
var reloadBrowser = function (done) {
	browserSync.reload();
	done();
};

var singleFile = {};
var copySingleFile = function (done) {
    return src(singleFile.src)
        .pipe(dest(singleFile.dest));
}

var copyThalia = function (done) {
    return src(`server/thalia.js`)
        .pipe(dest(`websites/${site}/server/`));
}

// Watch for changes
var watchSource = function (done) {

    watch(paths.copy.input, series(copyFiles, reloadBrowser));
    watch(paths.copy.input).on("change", function(path, stats){
        singleFile.src = path;
        singleFile.dest = path.match(/.*\//g)[0].replace("src","dist");

        series(copySingleFile, reloadBrowser)();
    });

    watch(paths.scripts.input, series(buildScripts, reloadBrowser));
    watch(paths.scripts.input, series(reloadBrowser));

// TODO: Watch for changes in Boilerplate?
    watch(paths.styles.input, series(buildStyles, reloadBrowser));
    watch(paths.views, series(reloadBrowser));
    watch(paths.scaffold, series(reloadBrowser));

    try {
        watch(paths.public, series(reloadBrowser));
    } catch(e) {
        console.log("No public folder", e);
    };

    watch(`websites/${site}/dist/**/*.js`, series(reloadBrowser));

    if (fs.existsSync(`websites/${site}/server/thalia.js`)) watch(`server/thalia.js`, series(copyThalia));

    if(siteConfig && siteConfig.publish && siteConfig.publish.dist) {
      console.log("watching for published files")
      watch(siteConfig.publish.dist.map(file => `websites/${site}/dist/${file}`), series(publish));
    }

	// done();
};

/**
 * Allow specification of dist files to be copied to the public folder.
 */
var publish = function (done) {
    if(siteConfig && siteConfig.publish && siteConfig.publish.dist) {
        return src(siteConfig.publish.dist.map(file => `websites/${site}/dist/${file}`),
        {base: `websites/${site}/dist`,
        allowEmpty: true})
        .pipe(dest(paths.public));
    }
    done();
};
exports.publish = publish;

// Publishes to github pages, i.e. to the docs folder
var publishGithubPages = function (done) {
    if(siteConfig && siteConfig.publish && siteConfig.publish.dist) {
        return src(siteConfig.publish.dist.map(file => `websites/${site}/dist/${file}`),
        {base: `websites/${site}/dist`,
        allowEmpty: true})
            .pipe(dest(paths.docs));
    }
    done();
};
exports.publishGithubPages = publishGithubPages;


/**
 * Export Tasks
 */
var parallelBuildTasks = parallel(
		buildScripts,
		buildStyles,
		copyFiles
	);

// Default task
exports.default = exports.build = series(
    getWorkEnv,
	cleanDist,
    compileBoilerplate,
    getWorkEnv,
    parallelBuildTasks,
    publish
);

exports.buildAll = function(done) {
    const tasks = websites.map(website => {
    return function buildSite(taskDone) {
            setSite(website);
            series(cleanDist, compileBoilerplate, getWorkEnv, parallelBuildTasks)(taskDone);
        }
    });

    return series(...tasks)(done);

// In case you want to do something after doing everything
//   return series(...tasks, (seriesDone) => {
//     seriesDone();
//     done();
//   })();
}


// Watch and reload
exports.develop = series(
    getWorkEnv,
    startBrowserSync,
    parallelBuildTasks,
    watchSource
);








