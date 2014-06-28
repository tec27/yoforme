var xhr = require('xhr')

var targetUserInput = document.querySelector('#target-user')
  , messageInput = document.querySelector('#message')
  , sendButton = document.querySelector('#send-button')
  , demoForm = document.querySelector('#demo-form')
  , resultDiv = document.querySelector('#result')
  , resultText = document.querySelector('#result-text')

demoForm.addEventListener('submit', function(event) {
  event.preventDefault();

  var target = targetUserInput.value
    , message = messageInput.value
    , url = location.origin + '/' + encodeURIComponent(target) + '/' + encodeURIComponent(message)

  xhr({ url: url, method: 'POST' }, function(err, response, body) {
    sendButton.disabled = false
    sendButton.value = 'Send'
    resultDiv.style.display = 'block'
    var bodyText = response.statusCode + '\n\n'
    if (body) {
      try {
        bodyText += JSON.stringify(JSON.parse(body), null, 2)
      } catch (err) {
      }
    }
    resultText.innerHTML = bodyText
  })

  sendButton.disabled = true
  sendButton.value = 'Sending...'
})
