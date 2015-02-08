var gpio = require('rpi-gpio');

var pin = 15; //GPIO 22
var pin2 = 16; //GPIO 23
var lightLoopCounter = 0;
var inputCounter = 0;
var closeCounter = 0;
var delay = 1000;

//gpio.setup(pin, gpio.DIR_IN);
startCycle();
gpio.setPollFrequency(507);

gpio.on('change', function(channel, value) {
    console.log('Channel ' + channel + ' value is now ' + value);
});

function startCycle(){
    gpio.setup(pin2, gpio.DIR_OUT, writeOn);
}

function writeOn() {
    gpio.write(pin2, true, function(err) {
        if (err) throw err;
        console.log('Written to pin ' + pin2);
        pause(writeOff);
    });
}

function writeOff() {
    gpio.write(pin2, false, function(err) {
        if (err) throw err;
        console.log('Written to pin ' + pin2);
        if(lightLoopCounter < 10){
            pause(writeOn);
            lightLoopCounter++;
        }
        else{
            gpio.setup(pin2, gpio.DIR_IN, readInput);
            gpio.setPollFrequency(507);

            gpio.on('change', function(channel, value) {
                console.log('Channel ' + channel + ' value is now ' + value);
            });
        }
    });
}

function pause(callback){
    console.log('waiting ' + delay + ' milliseconds...');
    setTimeout(
        function(){ callback(); }, delay
    );
}

function closePins() {
    gpio.destroy(function() {
        console.log('All pins unexported');
        return process.exit(0);
    });
}

function readInput() {
    if(inputCounter < 10){
        console.log('reading input: ');
        gpio.read(pin, function (err, value) {
            console.log('The value of pin ' + pin + ' is ' + value);
            pause(readInput);
            inputCounter++;
        });
    }
    else{
        closePins();
    }
}