var gulp = require('gulp');
var serve = require('gulp-serve');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
// var jsx = require('gulp-jsx');
var react = require('gulp-react');
var concatCss = require('gulp-concat-css');


var path = {
  HTML: 'src/index.html',
  ALL: ['src/js/*.js', 'src/js/**/*.js', 'src/index.html'],
  JS: ['src/js/*.js', 'src/js/**/*.js'],
  CSS: ['src/css/*.css', 'src/css/**/*.css'],
  MINIFIED_OUT: 'build.min.js',
  DEST_SRC: 'dist/src',
  DEST_BUILD: 'dist/build',
  DEST: 'dist'
};

gulp.task('transform', function(){
  console.log("TRANSFORM");
  return gulp.src(path.JS)
    .pipe(react())
    .pipe(gulp.dest(path.DEST_SRC));
});

gulp.task('copy', function(){
  gulp.src(path.HTML)
    .pipe(gulp.dest(path.DEST));
  console.log('COPY');
  gulp.src(path.CSS)
    .pipe(gulp.dest(path.DEST_SRC));

});

gulp.task('css', function() {
  console.log('CSS');

  // gulp.src('src/css/*.css')
  //   .pipe(concatCss('bundle.css'))
  //   .pipe(gulp.dest(path.DEST_SRC));
  gulp.src(path.CSS)
    .pipe(concatCss('bundle.css'))
    .pipe(gulp.dest(path.DEST_SRC));
});

gulp.task('debug', function() {
  console.log('DEBUG!');
});

gulp.task('watch', function(){
  console.log('WATCH');
  // gulp.watch(path.ALL, ['debug']);
  // gulp.watch('src', ['debug']);
  // gulp.watch('src/index.html', ['debug']);
  gulp.watch('src/**/*.js', ['transform', 'copy']);
  gulp.watch('src/css/*.css', ['css']);
});

// gulp.task('build', function(){
//
//   // gulp.src(path.JS)
//   //   .pipe(react())
//   //   .pipe(concat(path.MINIFIED_OUT))
//   //   // .pipe(uglify(path.MINIFIED_OUT))
//   //   .pipe(gulp.dest(path.DEST_BUILD));
// });

gulp.task('replaceHTML', function(){
  return gulp.src(path.HTML)
    .pipe(htmlreplace({
      'js': 'build/' + path.MINIFIED_OUT
    }))
    .pipe(gulp.dest(path.DEST));
});

gulp.task('build', ['transform', 'css', 'copy']);

gulp.task('production', ['replaceHTML', 'build']);

// gulp.task('default', ['build', 'serve', 'watch']);
gulp.task('default', ['build', 'watch']);

gulp.task('serve', serve('.'));
//
// // gulp.task('build', function() {
// //   return gulp.src('src/*.js')
// //     .pipe(jsx())
// //     .pipe(gulp.dest('dist'));
// // });
//
// gulp.task('build', function() {
//   // place code for your default task here
//   return gulp.src('src/*.js')
//       .pipe(react())
//       .pipe(gulp.dest('dist'));
// });
