// Assigning modules to local variables
var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var bower = require('gulp-bower');
var pkg = require('./package.json');

// Set the banner content
var banner = ['/*!\n',
    ' * Start Bootstrap - <%= pkg.title %> v<%= pkg.version %> (<%= pkg.homepage %>)\n',
    ' * Copyright 2013-' + (new Date()).getFullYear(), ' <%= pkg.author %>\n',
    ' * Licensed under <%= pkg.license.type %> (<%= pkg.license.url %>)\n',
    ' */\n',
    ''
].join('');

// Default task
gulp.task('default', ['bower']);

// update bower dependencies
gulp.task('bower', function() {
    return bower();
});

// Configure the browserSync task
gulp.task('browserSync', function() {
    browserSync.init({
        server: {
            baseDir: ''
        },
    })
})

gulp.task('dev', ['bower', 'browserSync'], function() {
    // Reloads the browser whenever HTML or JS files change
    gulp.watch('*.html', browserSync.reload);
    gulp.watch('site/*.html', browserSync.reload);
    gulp.watch('js/**/*.js', browserSync.reload);
});
