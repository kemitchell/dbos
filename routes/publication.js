var Negotiator = require('negotiator')
var ecb = require('ecb')
var formatDate = require('../format-date')
var fs = require('fs')
var isDigest = require('is-sha-256-hex-digest')
var methodNotAllowed = require('./method-not-allowed')
var mustache = require('mustache')
var notFound = require('./not-found')
var parse = require('json-parse-errback')
var path = require('path')
var runParallel = require('run-parallel')
var send = require('send')

var TEMPLATE = path.join(
  __dirname, '..', 'templates', 'publication.html'
)

module.exports = function (request, response, configuration) {
  if (request.method === 'GET') {
    var digest = request.params.digest
    if (!isDigest(digest)) {
      notFound(request, response)
    } else {
      var type = new Negotiator(request).mediaType([
        'application/json', 'text/html'
      ])
      if (!type) {
        response.statusCode = 415
        response.end()
      } else {
        var pathPrefix = path.join(
          configuration.directory, 'publications', digest
        )
        var json = pathPrefix + '.json'
        /* istanbul ignore else */
        if (type === 'application/json') {
          send(request, json)
            .on('error', /* istanbul ignore next */ function (error) {
              request.log.error(error)
              response.statusCode = error.status || 500
              response.end()
            })
            .pipe(response)
        } else if (type === 'text/html') {
          var template
          var data
          var signature
          var sig = pathPrefix + '.sig'
          runParallel([
            function (done) {
              fs.readFile(TEMPLATE, 'utf8', ecb(done, function (read) {
                template = read
                done()
              }))
            },
            function (done) {
              fs.readFile(json, 'utf8', ecb(done, function (read) {
                parse(read, ecb(done, function (parsed) {
                  data = parsed
                  done()
                }))
              }))
            },
            function (done) {
              fs.readFile(sig, 'utf8', ecb(done, function (read) {
                signature = read
                done()
              }))
            }
          ], function (error) {
            if (error) {
              request.log.error(error)
              response.statusCode = 500
              response.end()
            } else {
              data.date = formatDate(data.date)
              data.digest = formattedDigest(digest)
              data.signature = formattedSignature(signature)
              data.hostname = configuration.hostname
              if (data.description) {
                data.description = splitIntoParagraphs(data.description)
              }
              if (data.safety) {
                data.safety = splitIntoParagraphs(data.safety)
              }
              response.end(
                mustache.render(template, data)
              )
            }
          })
        }
      }
    }
  } else {
    methodNotAllowed(response)
  }
}

function splitIntoParagraphs (string) {
  return string.split(/\n+/)
}

function formattedDigest (digest) {
  return (
    digest.slice(0, 32) +
    '<wbr>' +
    digest.slice(32)
  )
}

function formattedSignature (signature) {
  return (
    signature.slice(0, 32) +
    '<wbr>' +
    signature.slice(32, 64) +
    '<wbr>' +
    signature.slice(64, 96) +
    '<wbr>' +
    signature.slice(96)
  )
}
