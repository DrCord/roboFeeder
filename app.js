var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs")
port = process.argv[2] || 8888;


var gpio = require('rpi-gpio');

var motorReverse = 16;
var motorForward = 18;
var motorEnable = 22;

var delay = 5000;

http.createServer(function(request, response) {

    /*var serialport = require("serialport");
    var SerialPort = serialport.SerialPort; // localize object constructor

    var sp = new SerialPort("/dev/ttyAMA0", {
        baudrate: 9600,
        parser: serialport.parsers.raw
    });
    sp.on("open", function () {
        console.log('open');
        sp.on('data', function(data) {
            var buff = new Buffer(data, 'utf8');
            var encoded_hex = buff.toString('hex');
            var encoded_int = parseInt(encoded_hex, 16);
            //console.log('data received: ' + data);
            console.log('encoded hex data: ' + encoded_hex);
            console.log('encoded int data: ' + encoded_int);
        });
        //sp.write("ls\n", function(err, results) {
        //    console.log('err ' + err);
        //    console.log('results ' + results);
        //});
    });*/

    gpio.setup(motorForward, gpio.DIR_OUT, forward);
    gpio.setup(motorReverse, gpio.DIR_OUT, reverse);
    gpio.setup(motorEnable, gpio.DIR_OUT, motorOn);

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

    var uri = url.parse(request.url).pathname
        , filename = path.join(process.cwd(), uri);

    path.exists(filename, function(exists) {
        if(!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
            response.end();
            return;
        }

        if (fs.statSync(filename).isDirectory()) filename += '/index.html';

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