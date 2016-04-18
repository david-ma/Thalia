/* jshint node: true */
/* global $: true */
"use strict";

var gulp 		= require("gulp");
var $ 			= require("gulp-load-plugins")({});
var rimraf 		= require("rimraf");
var envProd 	= false;
var runSequence = require('run-sequence');

// Editable - any file extensions added here will trigger the watch task and will be instantly copied to your /dist folder
var staticSrc = "src/**/*.{eot,ttf,woff,woff2,otf,json,pdf}";
var browserSync = require('browser-sync').create();
var dist = "websites/reddit/dist"

// Clean
gulp.task("clean", function() {
	return rimraf.sync(dist);
});

gulp.task("cacheclear", function() {
	$.cache.clearAll();
});

// Copy staticSrc
gulp.task("copy", function() {
	return gulp.src(staticSrc, {
		base: "src"
	}).pipe( gulp.dest(dist) );
});

// Compile Partials
gulp.task('html', function() {
	gulp.src(['src/*.html'])
		.pipe($.fileInclude({
			prefix: '@@',
			basepath: 'src/partials/'
		}))
		.pipe($.htmlmin({
		// Editable - see https://www.npmjs.com/package/gulp-minify-html#options for details
			minifyJS: true
		}))
		.pipe(gulp.dest(dist+'/'));
});

// Concatenate JS
gulp.task("jsconcat", function() {
	return gulp.src([
			// Editable - Add any additional paths to JS Bower components here

			// Uncomment the following line to use jQuery
			"bower_components/d3/d3.min.js",
			"bower_components/jquery/dist/jquery.min.js",
			'bower_components/bootstrap-sass/assets/javascripts/bootstrap.min.js',
			"bower_components/jqGrid/js/jquery.jqGrid.min.js",
			'node_modules/socket.io-client/socket.io.js',
			"src/js/vendor/*.js"
		]).pipe( $.concat("vendor.min.js"))
		.pipe( gulp.dest(dist+"/js"));
});

// JSHint
gulp.task("jshint", function () {
	return gulp.src("src/js/*.js")
		.pipe( $.jshint() )
		.pipe( $.jshint.reporter( "jshint-stylish" ) )
		.pipe( $.jshint.reporter('fail') )
		.on('error', function(e) {
			if(!envProd) {
				$.notify().write(e);
			}
		});
});

// Compile JS
gulp.task( "javascript", ["jshint"], function() {
	var out = gulp.src([
			"src/js/plugins/*.js",
			"src/js/*.js"
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
gulp.task("images", function(cb) {
	return gulp.src('src/img/**/*', {
		base: "src/img"
	}).pipe( gulp.dest( dist+"/img" ) );
});

// Stylesheets
gulp.task("stylesheets", function() {
	var paths = [
		// Editable - Defines directories where Bower CSS includes can be found. Also make sure to add the usual @import to you main.scss file

		// Uncomment the following two lines to use Bourbon/Neat
		// 'bower_components/neat/app/assets/stylesheets',

		'bower_components/bourbon/app/assets/stylesheets',
		'bower_components/bootstrap-sass/assets/stylesheets',
		'bower_components/normalize-scss'
	];

	var out = gulp.src('src/css/main.scss')
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
gulp.task( "watch", ["stylesheets", "javascript", "jsconcat", "images", "html", "copy"], function() {
	$.livereload.listen();

	gulp.watch(staticSrc, ["copy"]);
	gulp.watch("src/**/*.html", ["html"]);
	gulp.watch("src/js/vendor/*.js", ["jsconcat"]);
	gulp.watch("src/css/**/*.scss", ["stylesheets"]);
	gulp.watch("src/js/**/*.js", ["javascript"]);
	gulp.watch("src/img/**/*.{jpg,png,svg}", ["images"]);

	gulp.watch([
		dist+"/**/*.html",
		dist+"/**/*.js",
		dist+"/**/*.css",
		dist+"/img/**/*"
	]).on( "change", function( file ) {
		$.livereload.changed(file.path);
	});
});

// Serve
gulp.task('serve', ["stylesheets", "javascript", "jsconcat", "images", "html", "copy", "watch"], function() {
		browserSync.init({
			ghostMode: false,
			proxy: "localhost", // Editable - defines proxy URL
			server: {
				baseDir: dist+"/"
			}
	});
	gulp.watch(staticSrc, ["copy"]);
	gulp.watch("src/js/vendor/*.js", ["jsconcat"]);
	gulp.watch("src/scss/**/*.scss", ["stylesheets"]).on("change", browserSync.reload);
	gulp.watch("src/js/*.js", ["javascript"]).on("change", browserSync.reload);
	gulp.watch(dist+"/*.html").on("change", browserSync.reload);
});

// Build
gulp.task( "build", [
	"production_env",
	"clean",
	"stylesheets",
	"javascript",
	"jsconcat",
	"images",
	"html",
	"copy"
], function () {});

// Deploy
gulp.task( "deploy", function(callback) {
	runSequence(
		'build',
		'publish',
		 callback)
});

// Publish to S3
gulp.task('publish', function() {

	var publisher = awspublish.create({
			region: 'ap-southeast-2', // Editable - S3 bucket region
			params: {
				Bucket: 'example-bucket' // Editable - S3 bucket name
			},
			"accessKeyId": process.env.AWS_ACCESS_KEY,
			"secretAccessKey": process.env.AWS_SECRET_KEY
		});

	var files = gulp.src([dist+'/**'])
		.pipe(publisher.publish());

	return files
		.pipe(publisher.cache())
		.pipe(awspublish.reporter());
});