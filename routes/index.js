var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
  //setup serial port to read RFID
  var serialport = require("serialport");
  var SerialPort = serialport.SerialPort; // localize object constructor
  var sp = new SerialPort("/dev/ttyAMA0", {
    baudrate: 9600,
    parser: serialport.parsers.raw
  });
  //open serial port
  sp.on("open", function () {
    console.log('open');
    //on data received
    sp.on('data', function(data) {
      //read as utf8
      var buff = new Buffer(data, 'utf8');
      //convert to hex
      var encoded_hex = buff.toString('hex');
      //convert to integer
      var encoded_int = parseInt(encoded_hex, 16);
      //console.log('data received: ' + data);
      console.log('encoded hex data: ' + encoded_hex);
      console.log('encoded int data: ' + encoded_int);
    });
  });

  var gpio = require('rpi-gpio');

  var pin   = 23;
  var delay = 2000;
  var count = 0;
  var max   = 3;

  gpio.on('change', function(channel, value) {
    console.log('Channel ' + channel + ' value is now ' + value);
  });
  gpio.setup(pin, gpio.DIR_OUT, on);

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
