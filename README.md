# yoforme
A simple API endpoint to send a short Yo message to a target user.

[yofor.me](http://yofor.me)

##Rationale
Yo can be useful as a way to send generic push notifications for almost anything,
but to send any sort of information other than 'Yo' requires that we modify the
username we're sending from. This is not a problem with `yoplait`, but if we
naively register users all the time, each unique message can only be sent once.

`yoforme` attempts to solve this by providing a simple HTTP API everyone can use
that keeps track of names (messages) it has registered and re-uses them. This
allows many different people to send the same message to different targets, and
builds a common repository of message accounts.

##License
MIT
