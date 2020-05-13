const gulp = require('gulp');
const jasmineBrowser = require('gulp-jasmine-browser');
const watch = require('gulp-watch');
const open = require('gulp-open');
var webpack = require('webpack-stream');

const filesForTest = [
  'src/components/Warnings.js',
  'src/components/WarningChecker.js',
  'src/components/HighlightGenerator.js',
  'src/components/JustNotSorry.js',
  'spec/**/*Spec.js',
];

const port = 8888;

gulp.task('jasmine-browser', function () {
  var JasminePlugin = require('gulp-jasmine-browser/webpack/jasmine-plugin');
  var plugin = new JasminePlugin();
  return gulp
    .src(filesForTest)
    .pipe(
      webpack({
        watch: true,
        devtool: 'inline-source-map',
        output: { filename: 'spec.js' },
        mode: 'development',
        plugins: [plugin],
      })
    )
    .pipe(jasmineBrowser.specRunner())
    .pipe(jasmineBrowser.server({ whenReady: plugin.whenReady, port }));
});

gulp.task('jasmine-headless-chrome', function () {
  return gulp
    .src(filesForTest)
    .pipe(
      webpack({
        output: { filename: 'spec.js' },
        mode: 'development',
      })
    )
    .pipe(jasmineBrowser.specRunner({ console: true }))
    .pipe(jasmineBrowser.headless({ driver: 'chrome' }));
});
