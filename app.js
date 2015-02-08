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

//debug true turns on all console.log msgs
var debug = true;

var Rfid = {
    allowedTags: [
        //uses strings to preserve leading zeros
        //TODO read these from a file
        '02150427',
        '03304786'
    ]
};

//setup pins vars and motor functions
var Motor = {
    reversePin: 16,
    forwardPin: 18,
    enablePin: 22,
    runTime: 3500,
    running: false,
    on: function(){
        print_debug_msg('Motor.on called');
        if(!Motor.running){
            Motor.running = true;
            gpio.write(Motor.enablePin, true, function(err) {
                if (err) throw err;
                print_debug_msg('Motor.enablePin ' + Motor.enablePin + ' set HIGH');
            });
            setTimeout(function() {
                Motor.off();
            }, Motor.runTime);
        }
    },
    off: function(){
        print_debug_msg('Motor.off called');
        Motor.running = false;
        gpio.write(Motor.enablePin, false, function(err) {
            if (err) throw err;
            print_debug_msg('Motor.enablePin ' + Motor.enablePin + ' set LOW.');
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
            print_debug_msg('Motor.forwardPin ' + Motor.forwardPin + ' set LOW.');
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            print_debug_msg('Motor.reversePin ' + Motor.reversePin + ' set LOW.');
        });
    },
    forward: function(){
        print_debug_msg('Motor.forward called');
        Motor.on();
        gpio.write(Motor.forwardPin, true, function(err) {
            if (err) throw err;
            print_debug_msg('Motor.forwardPin ' + Motor.forwardPin + ' set HIGH.');
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            print_debug_msg('Motor.reversePin ' + Motor.reversePin + ' set LOW.');
        });
    },
    reverse: function(){
        print_debug_msg('Motor.reverse called');
        Motor.on();
        gpio.write(Motor.reversePin, true, function(err) {
            if (err) throw err;
            print_debug_msg('Motor.reversePin ' + Motor.reversePin + ' set HIGH');
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
            print_debug_msg('Written to pin: ' + Motor.reversePin + ' set LOW');
        });
    }
};

function closePins(){
    gpio.destroy(function() {
        print_debug_msg('--- All pins un-exported, gpio closed ---');
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

function print_debug_msg(msg){
    if(debug){
        console.log(msg);
    }
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
        //print_debug_msg('data received: ' + data);
        //print_debug_msg('encoded hex data: ' + encoded_hex);
        //print_debug_msg('encoded int data: ' + encoded_int);
        Serial.checkCode(encoded_int);
    },
    checkCode: function(code){
        //print_debug_msg('checkCode - incoming code: ', code);
        zerofilled_code = zeroFill( code, 8 );
        //print_debug_msg('zerofilled code: ', zerofilled_code);
        var codeIndex = null;
        for(var i=0; i < Rfid.allowedTags.length; i++){
            //print_debug_msg('Rfid.allowedTags[i]: ', Rfid.allowedTags[i]);
            if(Rfid.allowedTags[i] == zerofilled_code){
                codeIndex = i;
                break;
            }
        }
        //print_debug_msg('codeIndex: ', codeIndex);
        if(codeIndex !== null){
            print_debug_msg('tag match');
            if(codeIndex === 0){
                //white tag index 0
                print_debug_msg('white tag match: ', code);
                Motor.forward();
            }
            else if(codeIndex === 1){
                //blue tag index 1
                print_debug_msg('blue tag match: ', code);
                Motor.reverse();
            }
        }
    }
};

Serial.sp.on("open", function() {
    print_debug_msg('Serial connection open.');
    Serial.sp.on('data', function(data) {
        Serial.receiveData(data);
    });
});

gpio.on('change', function(channel, value){
    //send monitoring data to server for monitor on site
    print_debug_msg('Channel ' + channel + ' value is now ' + value);
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
    print_debug_msg('Motor Pins set up');
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