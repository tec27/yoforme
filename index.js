var restify = require('restify')
  , yoplait = require('yoplait')
  , level = require('level')
  , analytics = require('nodealytics')

analytics.initialize('UA-4828044-5', 'yofor.me')

var db = level('./data/', {
  createIfMissing: true,
  valueEncoding: 'json'
})

function acquireUser(username, cb) {
  db.get('user\xff' + username, function(err, value) {
    if (err) {
      if (!err.notFound) {
        return cb(err)
      } else {
        return registerUser()
      }
    }

    yoplait.existingUser(username, value.udid, cb)
    analytics.trackEvent('acquireUser', 'existing', function() {})
  })

  function registerUser() {
    analytics.trackEvent('acquireUser', 'newSignup', function() {})
    var udid = yoplait.genUdid()
    yoplait.newUser(username, udid, function(err, yoUser) {
      if (err) {
        // TODO(tec27): if the username is already registered but not by us, we can probably use
        // unprintable/whitespace characters to register a similar looking name anyway
        return cb(err)
      }

      db.put('user\xff' + username, { udid: udid }, function(err) {
        if (err) {
          return cb(err)
        }

        cb(null, yoUser)
      })
    })
  }
}

var server = restify.createServer()
server.listen(process.env.PORT || 7777, function() {
  console.log('%s listening at %s', server.name, server.url)
})

server.use(restify.acceptParser(server.acceptable))
server.use(restify.throttle({ rate: 1, burst: 5, ip: true }))

server.get(/\/.*/, restify.serveStatic({
  directory: './static',
  default: 'index.htm'
}))

function validateTarget(req, res, next) {
  if (!req.params.target || !/^[A-Z][A-Z0-9]*$/i.test(req.params.target)) {
    return next(new restify.InvalidArgumentError('Yo targets must start with a letter, and only ' +
        'contain letters and numbers'))
  }

  next()
}

function validateMessage(req, res, next) {
  if (!req.params.message) {
    return next(new restify.InvalidArgumentError('Yo message must be specified'))
  }
  if (req.params.message.length > 42) {
    return next(new restify.InvalidArgumentError('Yo messages must be 42 characters or less'))
  }

  next()
}

function doYo(req, res, next) {
  acquireUser(req.params.message, function(err, yoUser) {
    if (err) {
      res.send(502, { code: err.serverCode, message: err.serverError })
      analytics.trackEvent('sendYoResult', 'yoAcquireError', function() {})
      return next()
    }

    var yoTarget = req.params.target.toUpperCase()
    yoUser.sendYo(yoTarget, function(err) {
      if (err) {
        res.send(502, { code: err.serverCode, message: err.serverError })
        analytics.trackEvent('sendYoResult', 'yoSendError', function() {})
        return next()
      }

      res.send(200, { status: 'OK' })
      analytics.trackEvent('sendYoResult', 'yoSent', function() {})
      next()
    })
  })
}

server.post('/:target/:message', validateTarget, validateMessage, doYo)
