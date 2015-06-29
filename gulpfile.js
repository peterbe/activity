var gulp = require('gulp');
var serve = require('gulp-serve');
var jsx = require('gulp-jsx');

gulp.task('serve', serve('.'));

gulp.task('build', function() {
  return gulp.src('src/*.js')
    .pipe(jsx())
    .pipe(gulp.dest('dist'));
});

gulp.task('default', function() {
  // place code for your default task here
});
