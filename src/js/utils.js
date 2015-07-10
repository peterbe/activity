// from http://www.deluxeblogtips.com/2010/04/get-gravatar-using-only-javascript.html
// with some modifications
function get_gravatar(email, size, secure) {
  secure = secure || false;
  size = size || 80;
  var base;
  if (secure) base = 'https://secure.gravatar.com/';
  else base = 'http://www.gravatar.com/';
  return base + 'avatar/' + MD5(email) + '.jpg?s=' + size;
}
