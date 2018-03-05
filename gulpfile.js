/* jshint node: true */
/* global $: true */
"use strict";

var gulp 		= require("gulp");
var $ 			= require("gulp-load-plugins")({});
var del 		= require("del");
var envProd 	= false;
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var confirm = require('gulp-confirm');
var fs = require('fs');

// Editable - any file extensions added here will trigger the watch task and will be instantly copied to your /dist folder
var staticSrc = "src/**/*.{eot,ttf,woff,woff2,otf,json,pdf,ico,xml,js,css,csv,tsv}";
var browserSync = require('browser-sync').create();
var dist = "websites/example/public";
var site = "websites/example";
var confirmation = false;

gulp.task("workspace", function(){
	if (argv.s === true || argv.site === true) {
		$.notify().write("You need to use -s or --site to specify which site you're using.");
	} else if (argv.s || argv.site) {
		var workspace = argv.s || argv.site;
		site = "websites/"+workspace;
		console.log("Getting input files from: "+workspace+"/src");
	}
});

gulp.task("confirm", ["workspace"], function(){
	try {
		fs.statSync(site+"/src");
		if(site !== 'websites/example' && !confirmation) {
			return gulp.src('').pipe(confirm({
				// Static text.
				question: 'Delete and rebuild '+site+'/public? (type "yes" to confirm)',
				proceed: function(answer) {
					confirmation = true;
					if(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
						dist = site+"/public";
						console.log("Setting file output to: "+dist);
						return true;
					} else {
						console.log("Ok, exiting without deleting anything");
						process.exit();
					}
				}
			}));
		}
	} catch (err) {
		console.log('ERROR! Could not find "'+site+"/src', do NOT build this project.");
		console.log("Running gulp on your project will delete the public folder.");
		process.exit();
	}
});

// Clean
gulp.task("clean", ["confirm"], function() {
  return del.sync([ dist+"/**/*",
                    "!"+dist,
                    "!"+dist+"/.dropbox",
                    "!"+dist+"/Icon?",
                    "!"+dist+"/images",
                    "!"+dist+"/images/uploads",
                    "!"+dist+"/images/uploads/**/*"
                ]);
});

gulp.task("cacheclear", function() {
	$.cache.clearAll();
});

// Copy staticSrc
gulp.task("copy", ["confirm"], function() {
	return gulp.src(staticSrc, {
		base: "src"
	}).pipe( gulp.dest(dist) );
});
gulp.task("sitecopy", ["copy", "confirm"], function(){
	return gulp.src(site+"/"+staticSrc, {
		base: site+"/src"
	}).pipe( gulp.dest(dist) );
});

// Compile Partials
gulp.task('html', ["confirm"], function() {
	gulp.src(['src/**/*.html', site+'/src/**/*.html'])
		.pipe($.fileInclude({
			prefix: '@@',
			basepath: 'src/partials/'
		}))
		.pipe($.htmlmin({
			// Editable - see https://www.npmjs.com/package/gulp-minify-html#options for details
			minifyJS: envProd
		}))
		.on('error', function(e) {
			if(!envProd) {
				console.log("Error in this HTML file:");
				console.log(e.fileName);

				$.notify().write("HTML Parse Error");
			}
		})
		.pipe(gulp.dest(dist+'/'));
});

// Concatenate JS
gulp.task("jsconcat", ["confirm"], function() {
	return gulp.src([
		// Editable - Add any additional paths to JS Bower components here

		// Declare these first, so they are used in this order.
		"src/js/vendor/d3.min.js",
        "src/js/vendor/d3-selection-multi.v1.min.js",
        "src/js/vendor/d3-fetch.v1.min.js",
		"src/js/vendor/jquery.min.js",
		'src/js/vendor/bootstrap.min.js',


// These are nice to have, but we don't need them for every page!
// 		"bower_components/jquery-ui/jquery-ui.min.js",
// 		'bower_components/datatables.net/js/jquery.dataTables.min.js',
// 		'bower_components/datatables.net-colreorder/js/dataTables.colReorder.min.js',
// 		'bower_components/datatables.net-select/js/dataTables.select.min.js',
// 		'bower_components/datatables.net-bs/js/dataTables.bootstrap.min.js',
		"src/js/vendor/*.js"
	]).pipe( $.concat("vendor.min.js"))
		.pipe( gulp.dest(dist+"/js"));
});

// JSHint
gulp.task("jshint", function () {
  // -l for lint
	if (argv.l === true) {
    return gulp.src(["src/js/*.js", site+'/src/js/*.js'])
      .pipe( $.jshint() )
      .pipe( $.jshint.reporter( "jshint-stylish" ) )
      .pipe( $.jshint.reporter('fail') )
      .on('error', function(e) {
        if(!envProd) {
          $.notify().write(e);
        }
      });
	} else {
    return gulp.src(["src/js/*.js", site+'/src/js/*.js'])
    .pipe( $.jshint() )
    .on('error', function(e) {
      if(!envProd) {
        $.notify().write(e);
      }
    });
	}
});

// Compile JS
gulp.task( "javascript", ["jshint", "confirm"], function() {
	var out = gulp.src([
			"src/js/plugins/*.js",
			"src/js/*.js",
			site+'/src/js/*.js'
		])
		.pipe( $.concat( "scripts.min.js" ));

	if(!envProd) {
		out.pipe($.sourcemaps.init({loadMaps: true}))
			.pipe($.sourcemaps.write());
	} else {
		out.pipe($.uglify());
	}
	return out.pipe( gulp.dest( dist+"/js" ) );
});

// Images
gulp.task("images", ["confirm"], function(cb) {
	return gulp.src([
// 		'bower_components/jquery-ui/themes/cupertino/images/*',
// 		'bower_components/datatables.net-dt/images/*'
		site+'/src/images/**/*',
		'src/images/**/*'
	]).pipe( gulp.dest( dist+"/images" ) );
});

// Fonts
gulp.task('fonts', ["copy", "confirm"], function() {
	return gulp.src([
		// 'bower_components/bootstrap-sass/assets/fonts/**/*',
		// 'bower_components/font-awesome/fonts/**/*'
		'src/fonts/**/*'
	]).pipe(gulp.dest(dist+'/fonts/'));
});

// Static CSS
gulp.task("staticCSS", ["confirm"], function(cb) {
	return gulp.src([
// These should not be on by default...
// 		'bower_components/jquery-ui/themes/cupertino/jquery-ui.min.css',
// 		'bower_components/datatables.net-dt/css/jquery.dataTables.min.css',
// 		'bower_components/datatables.net-bs/css/dataTables.bootstrap.min.css',
// 		'bower_components/datatables.net-colreorder-dt/css/colReorder.dataTables.min.css',
// 		'bower_components/datatables.net-select-dt/css/select.dataTables.min.css'
	]).pipe( gulp.dest( dist+"/css" ) );
});

// Stylesheets
gulp.task("stylesheets", [], function() {
	var out = gulp.src([
			site+'/src/css/**/*.scss'
		])
		.pipe( $.sourcemaps.init() )
		.pipe( $.cssGlobbing({
			extensions: ['.scss']
		}))
		.pipe( $.sass({
			style: 'expanded'
		}))
		.on('error', $.sass.logError)
		.on('error', function(e) {
			if(!envProd) {
				$.notify().write(e);
			}
		})
		.pipe( $.autoprefixer({
				browsers: ['last 2 versions'], // Editable - see https://github.com/postcss/autoprefixer#options
				cascade: false
			})
		);

	if(!envProd) {
		out.pipe( $.sourcemaps.write() );
	} else {
		out.pipe( $.csso() );
	}

	return out.pipe( gulp.dest(dist+'/css') );
});

// mainCSS
gulp.task("mainCSS", ["stylesheets"], function() {
    var paths = [
        'src/css/vendor'
    ];
    var out = gulp.src([
        'src/css/main.scss',
        site+'/src/css/main.scss'
    ])
        .pipe( $.concat('main.scss'))
        .pipe( $.sourcemaps.init() )
        .pipe( $.cssGlobbing({
            extensions: ['.scss']
        }))
        .pipe( $.sass({
            style: 'expanded',
            includePaths: paths
        }))
        .on('error', $.sass.logError)
        .on('error', function(e) {
            if(!envProd) {
                $.notify().write(e);
            }
        })
        .pipe( $.autoprefixer({
                browsers: ['last 2 versions'], // Editable - see https://github.com/postcss/autoprefixer#options
                cascade: false
            })
        );

    if(!envProd) {
        out.pipe( $.sourcemaps.write() );
    } else {
        out.pipe( $.csso() );
    }

    return out.pipe( gulp.dest(dist+'/css') );
});

// Set Production Environment
gulp.task( 'production_env', function() {
	envProd = true;
});

// Livereload
gulp.task( "watch", ["mainCSS", "javascript", "jsconcat", "images", "fonts", "html", "copy", "sitecopy", "confirm"], function() {
	$.livereload.listen();

	gulp.watch([site+"/"+staticSrc, staticSrc], ["copy", "sitecopy"]);
	gulp.watch([site+"/src/**/*.html","src/**/*.html"], ["html"]);
	gulp.watch([site+"/src/js/vendor/*.js", "src/js/vendor/*.js"], ["jsconcat"]);
	gulp.watch([site+"/src/css/**/*.scss", "src/css/**/*.scss"], ["mainCSS"]);
	gulp.watch([site+"/src/js/**/*.js", "src/js/**/*.js"], ["javascript"]);
	gulp.watch([site+"/src/images/**/*.{jpg,png,svg}", "src/images/**/*.{jpg,png,svg}"], ["images"]);

	gulp.watch([
		dist+"/**/*.html",
		dist+"/**/*.js",
		dist+"/**/*.css",
		dist+"/images/**/*"
	]).on( "change", function( file ) {
		$.livereload.changed(file.path);
	});
});

// Serve
gulp.task('serve', ["mainCSS", "javascript", "jsconcat", "images", "html", "copy", "sitecopy", "staticCSS", "watch", "confirm"], function() {
	var bs = {
		server: { baseDir: dist+"/" },
		ghostMode: false
	};

	// Use the proxy thing, if we need the Thalia server
	// Only necessary if you're doing complicated stuff?
	if(argv.t) {
		bs = {
			proxy: "localhost:1337",
			ghostMode: false
		};
	}

	browserSync.init(bs);

	gulp.watch([site+"/"+staticSrc, staticSrc], ["copy", "sitecopy"]);
	gulp.watch([site+"/src/js/vendor/*.js", "src/js/vendor/*.js"], ["jsconcat"]);
	gulp.watch([site+"/src/css/**/*.scss", "src/css/**/*.scss"], ["mainCSS"]);
	gulp.watch(dist+"/**/*.css").on("change", browserSync.reload);
	gulp.watch([site+"/src/js/**/*.js", "src/js/**/*.js"], ["javascript"]);
	gulp.watch(dist+"/**/*.js").on("change", browserSync.reload);
	gulp.watch(dist+"/**/*.html").on("change", browserSync.reload);
});

// Build
gulp.task( "build", [
	"production_env",
	"clean",
	"mainCSS",
	"javascript",
	"jsconcat",
	"images",
	"fonts",
	"html",
	"copy",
	"sitecopy",
	"staticCSS"
], function () {});

// // Deploy
// gulp.task( "deploy", function(callback) {
// 	runSequence(
// 		'build',
// 		'publish',
// 		 callback)
// });
// 
// // Publish to S3
// gulp.task('publish', function() {
// 
// 	var publisher = awspublish.create({
// 			region: 'ap-southeast-2', // Editable - S3 bucket region
// 			params: {
// 				Bucket: 'example-bucket' // Editable - S3 bucket name
// 			},
// 			"accessKeyId": process.env.AWS_ACCESS_KEY,
// 			"secretAccessKey": process.env.AWS_SECRET_KEY
// 		});
// 
// 	var files = gulp.src([dist+'/**'])
// 		.pipe(publisher.publish());
// 
// 	return files
// 		.pipe(publisher.cache())
// 		.pipe(awspublish.reporter());
// });
