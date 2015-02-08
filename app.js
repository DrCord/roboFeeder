//setup web server
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs")
port = process.argv[2] || 8888;

// require rpi-gpio so we can use gpio
var gpio = require('rpi-gpio');
var async = require('async');

//setup serialport
var serialport = require("serialport");
var SerialPort = serialport.SerialPort; // localize object constructor

var Rfid = {
    allowedTags: [
        '02150427',
        '03304786'
    ]
};

//setup pins vars and motor functions
var Motor = {
    reversePin: 16,
    forwardPin: 18,
    enablePin: 22,
    runTime: 5000,
    on: function(){
        console.log('Motor.on called');
        gpio.write(Motor.enablePin, true, function(err) {
            if (err) throw err;
            console.log('Motor.enablePin ' + Motor.enablePin + ' set HIGH');
        });
        setTimeout(function() {
            Motor.off();
        }, Motor.runTime);
    },
    off: function(){
        console.log('Motor.off called')
        gpio.write(Motor.enablePin, false, function(err) {
            if (err) throw err;
            console.log('Motor.enablePin ' + Motor.enablePin + ' set LOW.');
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
            console.log('Motor.forwardPin ' + Motor.forwardPin + ' set LOW.');
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            console.log('Motor.reversePin ' + Motor.reversePin + ' set LOW.');
        });
    },
    forward: function(){
        console.log('Motor.forward called');
        Motor.on();
        gpio.write(Motor.forwardPin, true, function(err) {
            if (err) throw err;
            console.log('Motor.forwardPin ' + Motor.forwardPin + ' set HIGH.');
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            console.log('Motor.reversePin ' + Motor.reversePin + ' set LOW.');
        });
    },
    reverse: function(){
        console.log('Motor.reverse called');
        Motor.on();
        gpio.write(Motor.reversePin, true, function(err) {
            if (err) throw err;
            console.log('Motor.reversePin ' + Motor.reversePin + ' set HIGH');
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
            console.log('Written to pin: ' + Motor.reversePin + ' set LOW');
        });
    }
};

function closePins(){
    gpio.destroy(function() {
        console.log('--- All pins un-exported, gpio closed ---');
        return process.exit(0);
    });
}

function zeroFill( number, width ){
    width -= number.toString().length;
    if ( width > 0 )    {
        return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
    }
    return number + ""; // always return a string
}

var Serial = {
    sp: new SerialPort("/dev/ttyAMA0", {
            baudrate: 9600,
            parser: serialport.parsers.raw
        }),
    receiveData: function(data){
        var buff = new Buffer(data, 'utf8');
        var encoded_hex = buff.toString('hex');
        var encoded_int = parseInt(encoded_hex, 16);
        //console.log('data received: ' + data);
        //console.log('encoded hex data: ' + encoded_hex);
        //console.log('encoded int data: ' + encoded_int);
        Serial.checkCode(encoded_int);
    },
    checkCode: function(code){
        console.log('incoming code: ', code);
        zerofilled_code = zeroFill( code, 8 );
        console.log('zerofilled code: ', zerofilled_code);
        var codeIndex = null;
        for(var i=0; i < Rfid.allowedTags.length; i++){
            console.log('Rfid.allowedTags[i]: ', Rfid.allowedTags[i]);
            if(Rfid.allowedTags[i] == zerofilled_code){
                codeIndex = i;
                break;
            }
        }
        console.log('codeIndex: ', codeIndex);
        //must use strict equals
        if(codeIndex !== null){
            console.log('tag match');
            if(codeIndex === 0){
                //white tag index 0
                console.log('white tag match: ', code);
                Motor.forward();
            }
            else if(codeIndex === 1){
                //blue tag index 1
                console.log('blue tag match: ', code);
                Motor.reverse();
            }
        }
    }
};

Serial.sp.on("open", function() {
    console.log('Serial connection open.');
    Serial.sp.on('data', function(data) {
        Serial.receiveData(data);
    });
});

gpio.on('change', function(channel, value){
    //send monitoring data to server for monitor on site
    console.log('Channel ' + channel + ' value is now ' + value);
});

async.parallel([
    function(callback){
        gpio.setup(Motor.forwardPin, gpio.DIR_OUT, callback)
    },
    function(callback){
        gpio.setup(Motor.reversePin, gpio.DIR_OUT, callback)
    },
    function(callback){
        gpio.setup(Motor.enablePin, gpio.DIR_OUT, callback)
    },
], function(err, results){
    console.log('Motor Pins set up');
    Motor.on();
    Motor.forward();
});

http.createServer(function(request, response) {

    var uri = url.parse(request.url).pathname
        , filename = path.join(process.cwd(), uri);

    path.exists(filename, function(exists) {
        if(!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
            response.end();
            return;
        }

        if (fs.statSync(filename).isDirectory()) filename += 'index.html';

        fs.readFile(filename, "binary", function(err, file) {
            if(err) {
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write(err + "\n");
                response.end();
                return;
            }

            response.writeHead(200);
            response.write(file, "binary");
            response.end();
        });
    });
}).listen(parseInt(port, 10));

console.log("Static file server running at\n  => http://localhost:" + port + "/\nCTRL + C to $shutdown");