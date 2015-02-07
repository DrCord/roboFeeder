var express = require('express');
var router = express.Router();

var gpio = require('rpi-gpio');

var motorReverse = 16;
var motorForward = 18;
var motorEnable = 22;

var delay = 5000;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
  //motor test
  gpio.setup(motorForward, gpio.DIR_OUT, forward);
  gpio.setup(motorReverse, gpio.DIR_OUT, reverse);
  gpio.setup(motorEnable, gpio.DIR_OUT, motorOn);
});

module.exports = router;

function motorOn() {
    gpio.write(motorEnable, true, function(err) {
        if (err) throw err;
        console.log('Written to pin (on): ' + motorEnable);
    });
    setTimeout(function() {
        motorOff();
    }, delay);
}

function motorOff() {
    gpio.write(motorEnable, false, function(err) {
        if (err) throw err;
        console.log('Written to pin (off): ' + motorEnable);
    });
    closePins();
}

function forward() {
    gpio.write(motorForward, true, function(err) {
        if (err) throw err;
        console.log('Written to pin: ' + motorForward);
    });
    //gpio.write(motorReverse, false, function(err) {
    //    if (err) throw err;
    //    console.log('Written to pin ' + motorReverse);
    //});
}

function reverse() {
    //gpio.write(motorForward, false, function(err) {
    //    if (err) throw err;
    //    console.log('Written to pin: ' + motorForward);
    //});
    gpio.write(motorReverse, false, function(err) {
        if (err) throw err;
        console.log('Written to pin: ' + motorReverse);
    });
}

function closePins() {
    gpio.destroy(function() {
        console.log('All pins unexported');
        return process.exit(0);
    });
}