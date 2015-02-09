//setup web server
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs")
port = process.argv[2] || 8888;

// require rpi-gpio so we can use gpio
var gpio = require('rpi-gpio');
var async = require('async');
//require filesystem
var fs = require('fs');

//setup serialport
var serialport = require("serialport");
var SerialPort = serialport.SerialPort; // localize object constructor

var Rfid = {
    allowedTagsFileName: 'allowedTags.xml',
    //uses strings to preserve leading zeros
    //TODO: read allowed tags from a file
    allowedTags: [],
    parseAllowedTagFile: function(){

    }
};
var File = {
    readOptions : {
        encoding: 'utf8'
    },
    applicationPath: '/home/pi/roboFeeder'
};
//read allowed tags from file
fs.readFile(Rfid.allowedTagsFileName, File.readOptions, function (err, data) {
    if (err) throw err;
    console.log('fs.readFile(./' + Rfid.allowedTagsFileName);
    console.log(data);
});

//setup pins vars and motor functions
var Motor = {
    reversePin: 16,
    forwardPin: 18,
    enablePin: 22,
    runTime: 4000,
    waitTime: 5000,
    running: false,
    on: function(){
        //turns on the motor drive pin
        //needs to be called with Motor.forward or Motor.reverse to actually run motor
        Toolbox.printDebugMsg('Motor.on called');
        Toolbox.printDebugMsg('Motor.running: ' + Motor.running);
        if(!Motor.running){
            Motor.running = true;
            gpio.write(Motor.enablePin, true, function(err) {
                if (err) throw err;
                Toolbox.printDebugMsg('Motor.enablePin ' + Motor.enablePin + ' set HIGH');
            });
        }
    },
    off: function(){
        //turns all the way off all three pins involved
        Toolbox.printDebugMsg('Motor.off called');
        Toolbox.printDebugMsg('Motor.running: ' + Motor.running);
        Motor.running = false;
        gpio.write(Motor.enablePin, false, function(err) {
            if (err) throw err;
            Toolbox.printDebugMsg('Motor.enablePin ' + Motor.enablePin + ' set LOW.');
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
            Toolbox.printDebugMsg('Motor.forwardPin ' + Motor.forwardPin + ' set LOW.');
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            Toolbox.printDebugMsg('Motor.reversePin ' + Motor.reversePin + ' set LOW.');
        });
    },
    forward: function(){
        Toolbox.printDebugMsg('Motor.forward called');
        Motor.on();
        gpio.write(Motor.forwardPin, true, function(err) {
            if (err) throw err;
            Toolbox.printDebugMsg('Motor.forwardPin ' + Motor.forwardPin + ' set HIGH.');
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            Toolbox.printDebugMsg('Motor.reversePin ' + Motor.reversePin + ' set LOW.');
        });
    },
    reverse: function(){
        Toolbox.printDebugMsg('Motor.reverse called');
        Motor.on();
        gpio.write(Motor.reversePin, true, function(err) {
            if (err) throw err;
            Toolbox.printDebugMsg('Motor.reversePin ' + Motor.reversePin + ' set HIGH');
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
            Toolbox.printDebugMsg('Written to pin: ' + Motor.reversePin + ' set LOW');
        });
    }
};

var Gpio = {
    closePins: function(){
        gpio.destroy(function() {
            Toolbox.printDebugMsg('--- All pins un-exported, gpio closed ---');
            return process.exit(0);
        });
    }
};

var Toolbox = {
    debug: true, //turns on all debugging console.log messages
    zeroFill: function(number, width){
        width -= number.toString().length;
        if ( width > 0 )    {
            return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
        }
        return number + ""; // always return a string
    },
    printDebugMsg: function(msg){
        if(Toolbox.debug){
            console.log(msg);
        }
    }
};

var Serial = {
    sp: new SerialPort("/dev/ttyAMA0", {
            baudrate: 9600,
            parser: serialport.parsers.raw
        }),
    receiveData: function(data){
        var buff = new Buffer(data, 'utf8');
        var encoded_hex = buff.toString('hex');
        var encoded_int = parseInt(encoded_hex, 16);
        //Toolbox.printDebugMsg('data received: ' + data);
        //Toolbox.printDebugMsg('encoded hex data: ' + encoded_hex);
        //Toolbox.printDebugMsg('encoded int data: ' + encoded_int);
        Serial.checkCode(encoded_int);
    },
    checkCode: function(code){
        //Toolbox.printDebugMsg('checkCode - incoming code: ', code);
        zerofilled_code = Toolbox.zeroFill(code, 8);
        //Toolbox.printDebugMsg('zerofilled code: ', zerofilled_code);
        var codeIndex = null;
        for(var i=0; i < Rfid.allowedTags.length; i++){
            //Toolbox.printDebugMsg('Rfid.allowedTags[i]: ', Rfid.allowedTags[i]);
            if(Rfid.allowedTags[i] == zerofilled_code){
                codeIndex = i;
                break;
            }
        }
        //Toolbox.printDebugMsg('codeIndex: ', codeIndex);
        if(codeIndex !== null){
            Toolbox.printDebugMsg('tag match: ' + code);
            Robofeeder.cycle();
            //if(codeIndex === 0){
            //    //white tag index 0
            //    Toolbox.printDebugMsg('white tag match: ', code);
            //    Motor.forward();
            //}
            //else if(codeIndex === 1){
            //    //blue tag index 1
            //    Toolbox.printDebugMsg('blue tag match: ', code);
            //    Motor.reverse();
            //}
        }
    }
};

//for higher level functions
var Robofeeder = {
    options: {},
    open: function(){
        Motor.reverse();
        setTimeout(
            Motor.off,
            Motor.runTime
        );
    },
    close: function(){
        Motor.forward();
        setTimeout(
            Motor.off,
            Motor.runTime
        );
    },
    cycle: function(){
        Robofeeder.open();
        setTimeout(
            Robofeeder.close,
            Motor.waitTime
        );
    }
};

Serial.sp.on("open", function() {
    Toolbox.printDebugMsg('Serial connection open.');
    Serial.sp.on('data', function(data) {
        Serial.receiveData(data);
    });
});

gpio.on('change', function(channel, value){
    //send monitoring data to server for monitor on site
    Toolbox.printDebugMsg('Channel ' + channel + ' value is now ' + value);
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
    Toolbox.printDebugMsg('Motor Pins set up');
    Toolbox.printDebugMsg('Running initial open/close cycle');
    Robofeeder.cycle();
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