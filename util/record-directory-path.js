var path = require('path')

module.exports = function (directory, digest, done) {
  return path.join(directory, 'publications', digest)
}