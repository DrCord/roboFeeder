//setup web server
var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs")
port = process.argv[2] || 8888;

// require rpi-gpio so we can use gpio
var gpio = require('rpi-gpio');
//setup serialport
var serialport = require("serialport");
var SerialPort = serialport.SerialPort; // localize object constructor

var delay = 5000;

//setup pins vars and motor functions
var Motor = {
    reversePin: 16,
    forwardPin: 18,
    enablePin: 22,
    runTime: 5000,
    on: function(){
        gpio.write(Motor.enablePin, true, function(err) {
            if (err) throw err;
            console.log('Written to pin (on): ' + Motor.enablePin);
        });
        setTimeout(function() {
            Motor.off();
        }, Motor.runTime);
    },
    off: function(){
        gpio.write(Motor.enablePin, false, function(err) {
            if (err) throw err;
            console.log('Written to pin (off): ' + Motor.enablePin);
        });
        setTimeout(function() {
            closePins();
        }, Motor.runTime);
    },
    forward: function(){
        gpio.write(Motor.forwardPin, true, function(err) {
            if (err) throw err;
            console.log('Written to pin: ' + Motor.forwardPin);
        });
    },
    reverse: function(){
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            console.log('Written to pin: ' + Motor.reversePin);
        });
    }
};

function closePins() {
    gpio.destroy(function() {
        console.log('All pins unexported');
        return process.exit(0);
    });
}

var Serial = {
    sp:
        new SerialPort("/dev/ttyAMA0", {
            baudrate: 9600,
            parser: serialport.parsers.raw
        })
    ,
    receiveData: function(data){
        var buff = new Buffer(data, 'utf8');
        var encoded_hex = buff.toString('hex');
        var encoded_int = parseInt(encoded_hex, 16);
        //console.log('data received: ' + data);
        console.log('encoded hex data: ' + encoded_hex);
        console.log('encoded int data: ' + encoded_int);
    }
};

Serial.sp.on("open", function() {
    console.log('open');
    Serial.sp.on('data', function(data) {
        Serial.receiveData(data);
    });
});

gpio.setup(Motor.forwardPin, gpio.DIR_OUT, Motor.forward);
gpio.setup(Motor.reversePin, gpio.DIR_OUT, Motor.reverse);
gpio.setup(Motor.enablePin, gpio.DIR_OUT, Motor.on);

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