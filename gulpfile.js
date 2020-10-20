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
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var uglify = require('gulp-terser');

// Styles
var sass = require('gulp-sass');
var postcss = require('gulp-postcss');
var prefix = require('autoprefixer');
var minify = require('cssnano');


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
        typescript: {
            input: 'src/**/*.ts',
            output: workspace+'/dist/'
        },
        views: workspace+'/views/**/*.mustache',
        reload: './'+workspace+'/dist/'
    };

    jsTasks = lazypipe()
        .pipe(dest, paths.scripts.output)
        .pipe(rename, {suffix: '.min'})
        .pipe(uglify)
        .pipe(dest, paths.scripts.output);

    parallelBuildTasks(done);
}

var ts = require("gulp-typescript");
var tsProject = null;
var siteConfig = null;

function setSite(website){
    site = website;
    workspace = "websites/"+site;
    console.log(`Setting workspace to: ${workspace}`);

    tsProject = ts.createProject(`websites/${site}/tsconfig.json`);

    if(fs.existsSync(`${__dirname}/websites/${site}/config.js`)) {
        siteConfig = require(`${__dirname}/websites/${site}/config`).config;
    } else {
        siteConfig = require(`${__dirname}/websites/${site}/config/config`).config;
    }

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
        typescript: {
            input: workspace+'/src/**/*.ts',
            output: workspace+'/dist/'
        },
        views: workspace+'/views/**/*.mustache',
        public: workspace+'/public',
        reload: './'+workspace+'/dist/'
    };

    jsTasks = lazypipe()
        .pipe(dest, paths.scripts.output)
        .pipe(rename, {suffix: '.min'})
        .pipe(uglify)
        .pipe(dest, paths.scripts.output);
}

var getWorkEnv = function (done) {
    if (site) {
        setSite(site);
        return done();
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

        setSite(site);
        return done();
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
	return done();
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

// Lint scripts
var lintScripts = function (done) {
	// Lint scripts
	return src(paths.scripts.input)
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'));
};

// Process, lint, and minify Sass files
var buildStyles = function (done) {
    var scssLoadPaths = [
            'src/css/vendor/bootstrap',
            'src/css/vendor/bootstrap/mixins',
            'src/css/vendor'
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
			minify({
				discardComments: {
					removeAll: true
				}
			})
		]))
		.pipe(dest(paths.styles.output));

};



/**
 * Compile Typescript from src folder into dist folder
 */
var typescript = function (done) {

    // TODO: Use tsconfig input/output?
    // var input = tsProject.config.files
    // var output = tsProject.config.compilerOptions.outFile

    return src(paths.typescript.input)
        .pipe(tsProject())
        .js
        .pipe(dest(paths.typescript.output));
}




// Copy static files into output folder
var copyFiles = function (done) {
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

// Watch for changes
var watchSource = function (done) {

    // watch(paths.copy.input, series(copyFiles, reloadBrowser));
    watch(paths.copy.input).on("change", function(path, stats){
        singleFile.src = path;
        singleFile.dest = path.match(/.*\//g)[0].replace("src","dist");

        series(copySingleFile, reloadBrowser)();
    });

    watch(paths.scripts.input, series(lintScripts, buildScripts, reloadBrowser));
    watch(paths.styles.input, series(buildStyles, reloadBrowser));
    watch(paths.views, series(reloadBrowser));

    try {
        watch(paths.public, series(reloadBrowser));
    } catch(e) {
        console.log("No public folder", e);
    };

    watch(`websites/${site}/dist/**/*.js`, series(reloadBrowser));
    // watch([paths.typescript.input, `websites/${site}/tsconfig.json`], series(typescript, reloadBrowser));
    // watch('src/**/*.ts', series(typescript, reloadBrowser));

	done();
};

/**
 * Allow specification of dist files to be copied to the public folder.
 */
var publish = function (done) {
    if(siteConfig && siteConfig.publish && siteConfig.publish.dist) {

        return src(siteConfig.publish.dist.map(file => `websites/${site}/dist/${file}`),
        {base: `websites/${site}/dist`})
    		.pipe(dest(paths.public));
    }
    done();
}

/**
 * Export Tasks
 */
var parallelBuildTasks = parallel(
		buildScripts,
		lintScripts,
		buildStyles,
		typescript,
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
// gulp watch
exports.watch = series(
    getWorkEnv,
    startBrowserSync,
    watchSource
);








