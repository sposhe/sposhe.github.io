// modules
const fs      = require('fs')
const bsync   = require('browser-sync').create()
const webpack = require('webpack-stream')
const indexer = require('component-indexer')

// gulp
const { src, dest, series, parallel, watch } = require('gulp')

// gulp plugins
const pug                 = require('gulp-pug')
const sass                = require('gulp-sass')(require('sass'))
const data                = require('gulp-data')
const concat              = require('gulp-concat')
const rename              = require('gulp-rename')
const replace             = require('gulp-replace')
const xml2json            = require('gulp-xml2json')
const cleanCSS            = require('gulp-clean-css')
const sourcemaps          = require('gulp-sourcemaps')
const urlBuilder          = require('gulp-url-builder')
const jsonFormat          = require('gulp-json-format')
const jsonMinify          = require('gulp-json-minify')
const autoprefixer        = require('gulp-autoprefixer')
const htmlbeautify        = require('gulp-html-beautify')
const sassExtendShorthand = require('gulp-sass-extend-shorthand')

// helpers
const paths = (base, folders) => folders.map(folder => base + '/' + folder)
const popExt = (path) => {
  let baseArray = path.basename.split('.')
  path.extname = '.' + baseArray.pop()
  path.basename = baseArray.join('.')
  return path
}

// variables
const destination = 'docs'
const pugIndex = paths('src/pug', ['mixins'])
const sassIndex = paths('src/scss', [])
const locals = {}

// json
function jsonCompile() {
  return src([
    'src/json/**/*.pug'
  ]).pipe( pug({ doctype: 'xml' }) )
    .pipe( rename((path) => { path.extname = '.xml' }) )
    .pipe( xml2json({
      explicitRoot: false,
      explicitArray: false,
      ignoreAttrs: true
    }))
    .pipe( jsonFormat(2) )
    .pipe( replace(/(^\s*")at-/gm, '$1@') )
    .pipe( jsonMinify() )
    .pipe( replace(/^{"entity":/g, '') )
    .pipe( replace(/}$/g, '') )
    .pipe( rename((path) => { path.basename = path.basename.split('.')[0], path.extname = '.min.json' }) )
    .pipe( dest('src/json') )
    .pipe( jsonFormat(2) )
    .pipe( rename((path) => { path.basename = path.basename.split('.')[0] }) )
    .pipe( dest('src/json') )
}
function jsonWatch(cb) {
  watch(['src/json/**/*.pug', 'scr/pug/mixins/**/*.pug'], series(pugIndexer, jsonCompile))
  cb()
}

// pug
function pugIndexer(cb) {
  pugIndex.forEach(path => indexer(path, 'pug'))
  cb()
}
function pugCompile() {
  return src([
    'src/pug/views/**/*.pug'
  ]).pipe( pug({ locals }) )
    .pipe( htmlbeautify({ indent_size: 2, content_unformatted: ['script'] }) )
    .pipe( urlBuilder() )
    .pipe( dest(destination) )
    .pipe( bsync.reload({ stream: true }) )
}
function pugWatch(cb) {
  watch(['src/pug/**/*.pug', '!**/_index.*'], series(pugIndexer, pugCompile))
  cb()
}

// sass
function sassIndexer(cb) {
  sassIndex.forEach((dir) =>  indexer(dir, 'scss'))
  cb()
}
function sassShorthand() {
  return src([
    'src/scss/**/%*.+(sass|scss|css)'
  ]).pipe( sassExtendShorthand() )
    .pipe( rename(function(path) {
      path.basename = path.basename.replace('%','_')
    }) )
    .pipe( dest(file => file.base) )
}
function sassCompile() {
  return src([
    'src/scss/**/*.+(sass|scss|css)',
    '!src/scss/**/_*.*',
    '!src/scss/**/%*.*'
  ]).pipe( sass({ includePaths: ['node_modules'] }) )
    .pipe( autoprefixer() )
    .pipe( dest(`${destination}/css`) )
    .pipe( cleanCSS() )
    .pipe( rename((path) => { path.extname = '.min.css' }) )
    .pipe( dest(`${destination}/css`) )
    .pipe( bsync.reload({ stream: true }) )
}
function sassWatch(cb) {
  watch([
    'src/scss/**/%*.*'
  ], series(sassShorthand))
  watch([
    'src/scss/**/*.+(sass|scss)',
    '!src/scss/**/%*.*',
    '!src/scss/**/_index.*'
  ], series(sassIndexer, sassCompile))
  cb()
}

// browsersync
function sync() {
  bsync.init({
    server: {
      baseDir: `./${destination}`
    }
  })
}

// exports
exports.json    = series(jsonCompile)
exports.pug     = series(jsonCompile, pugIndexer, pugCompile)
exports.sass    = series(sassShorthand, sassIndexer, sassCompile)
exports.build   = parallel(exports.json, exports.pug, exports.sass)
exports.watch   = series(jsonWatch, pugWatch, sassWatch)
exports.default = series(exports.build, exports.watch, sync)
