var restify = require('restify')
  , yoplait = require('yoplait')
  , level = require('level')
  , analytics = require('nodealytics')

analytics.initialize('UA-4828044-5', 'yofor.me')

var db = level('./data/', {
  createIfMissing: true,
  valueEncoding: 'json'
})

var MAX_USER_TRIES = 4
function acquireUser(username, cb, tries) {
  tries = tries || 0
  if (tries >= MAX_USER_TRIES) {
    return cb(new Error('Couldn\'t acquire user.'))
  }

  db.get('user\xff' + username, function(err, value) {
    if (err) {
      if (!err.notFound) {
        return cb(err)
      } else {
        return registerUser()
      }
    }

    if (value.sessionToken) {
      yoplait.useExistingSession(value.udid, value.sessionToken, value.objectId, cb)
      analytics.trackEvent('acquireUser', 'existing', function() {})
    } else {
      // pre-password user, it's lost forever, gotta use a different one (try adding spaces)
      acquireUser(username + ' ', cb, tries + 1)
    }
  })

  function registerUser() {
    analytics.trackEvent('acquireUser', 'newSignup', function() {})
    var udid = yoplait.genUdid()
    yoplait.signUp(username, udid, udid, function(err, yoUser) {
      if (err) {
        if (err.serverCode == 202 && err.serverError.indexOf('already taken') > -1) {
          // Try adding spaces lol!
          return acquireUser(username + ' ', cb, tries + 1)
        }

        return cb(err)
      }

      var dataEntry = { udid: udid, sessionToken: yoUser.sessionToken, objectId: yoUser.objectId }
      db.put('user\xff' + username, dataEntry, function(err) {
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
