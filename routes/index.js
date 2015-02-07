var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
  //setup serial port to read RFID

  var gpio = require('rpi-gpio');

  var pin   = 23;
  var delay = 2000;
  var count = 0;
  var max   = 10;

  gpio.on('change', function(channel, value) {
    console.log('Channel ' + channel + ' value is now ' + value);
  });
  gpio.setup(23, gpio.DIR_OUT, off);
  gpio.setup(24, gpio.DIR_OUT, on);
  gpio.setup(25, gpio.DIR_OUT, on);

  function on() {
    if (count >= max) {
      gpio.destroy(function() {
        console.log('Closed pins, now exit');
        return process.exit(0);
      });
      return;
    }

    setTimeout(function() {
      gpio.write(pin, 1, off);
      count += 1;
    }, delay);
  }

  function off() {
    setTimeout(function() {
      gpio.write(pin, 0, on);
    }, delay);
  }

});

module.exports = router;
