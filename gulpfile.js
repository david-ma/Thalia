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
var {gulp, src, dest, watch, series, parallel} = require('gulp');
var del = require('del');
var flatmap = require('gulp-flatmap');
var lazypipe = require('lazypipe');
var rename = require('gulp-rename');
var package = require('./package.json');

// Scripts
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var concat = require('gulp-concat');
var uglify = require('gulp-terser');
var optimizejs = require('gulp-optimize-js');

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
    console.log("compiling boilerplate... ");

    paths = {
        input: 'src/',
        output: workspace+'/dist/',
        scripts: {
            input: 'src/**/*(?<!\.min)\.js',
            polyfills: '.polyfill.js',
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
        views: workspace+'/views',
        reload: './'+workspace+'/dist/'
    };

    jsTasks = lazypipe()
        .pipe(optimizejs)
        .pipe(dest, paths.scripts.output)
        .pipe(rename, {suffix: '.min'})
        .pipe(uglify)
        .pipe(optimizejs)
        .pipe(dest, paths.scripts.output);

    build(done);
}

function setSite(website){
    site = website;
    workspace = "websites/"+site;
    console.log(`Setting workspace to: ${workspace}`);

    /**
     * Paths to project folders
     */

    paths = {
        input: workspace+'/src/',
        output: workspace+'/dist/',
        scripts: {
            input: workspace+'/src/**/*(?<!\.min)\.js',
            polyfills: '.polyfill.js',
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
        views: workspace+'/views',
        public: workspace+'/public',
        reload: './'+workspace+'/dist/'
    };

    jsTasks = lazypipe()
        .pipe(optimizejs)
        .pipe(dest, paths.scripts.output)
        .pipe(rename, {suffix: '.min'})
        .pipe(uglify)
        .pipe(optimizejs)
        .pipe(dest, paths.scripts.output);
}

var getWorkEnv = function (done) {
    if (site) {
        setSite(site);
        return done();
    } else {

        if (argv.s === true || argv.site === true) {
            console.log("When using -s or --site, you must specify which site you're using.");
            process.exit(0);
        } else if (argv.s || argv.site) {
            site = argv.s || argv.site;
            if ( websites.indexOf(site) == -1 ) {
                console.log(`Website '${site}' does not exist.`);
                console.log("Please use one of the following: " + websites.join(", "));
                process.exit(0);
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


var browserify = require("browserify");
var source = require("vinyl-source-stream");
var tsify = require("tsify");

var typescript = function (done) {

    return browserify({
        basedir: ".",
        debug: true,
        entries: ["src/js/typescriptTest.ts"],
        cache: {},
        packageCache: {},
    })
        .plugin(tsify)
        .bundle()
        .pipe(source("bundle.js"))
        .pipe(dest(paths.typescript.output));

};

var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");

var typescript2 = function (done) {
    console.log("Alternate typescript compilation");

    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(dest(paths.typescript.output));
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
	browserSync.init({
        proxy: "localhost:1337",
        ghostMode: false
    });

	// Signal completion
	done();
};

// Reload the browser when files change
var reloadBrowser = function (done) {
	browserSync.reload();
	done();
};

// Watch for changes
var watchSource = function (done) {
    watch(paths.copy.input, series(copyFiles, reloadBrowser));

    watch(paths.scripts.input, series(lintScripts, buildScripts, reloadBrowser));
    watch(paths.styles.input, series(buildStyles, reloadBrowser));
    watch(paths.views, series(reloadBrowser));
    watch(paths.public, series(reloadBrowser));

    // watch(paths.typescript.input, series(typescript, reloadBrowser));
    // watch('src/**/*.ts', series(typescript, reloadBrowser));

	done();
};


/**
 * Export Tasks
 */
var build = parallel(
		buildScripts,
		lintScripts,
		buildStyles,
		// typescript,
		copyFiles
	);

// Default task
exports.default = exports.build = series(
    getWorkEnv,
	cleanDist,
	compileBoilerplate,
	getWorkEnv,
	build
);

exports.buildAll = function(done) {
    const tasks = websites.map(website => {
    return function buildSite(taskDone) {
            setSite(website);
            series(cleanDist, compileBoilerplate, getWorkEnv, build)(taskDone);
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
    compileBoilerplate,
    getWorkEnv,
    build,
	startBrowserSync,
	watchSource
);








