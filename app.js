/** setup node web server */
// require needed modules
var api = require('./routes/api'),
    async = require('async'), //allow better formatting for asynchronous calls - https://github.com/caolan/async
    bodyParser = require('body-parser'),
    datastore = require('nedb'),
    express = require('express'),
    fs = require('fs'),
    gpio = require('rpi-gpio'), // allow use of gpio - https://www.npmjs.com/package/rpi-gpio
    http = require('http'),
    log = require('npmlog'),
    path = require('path'),
    routes = require('./routes'),
    serialport = require('serialport'),
    url = require('url');
// setup ip and port
var applicationPath = '/home/pi/roboFeeder',
    ip = process.argv[2] || '192.168.1.116', // has to be actual ip of device
    port = process.argv[3] || 8080;

var app = module.exports = express();
// sets port to default(8080) unless otherwise specified via script init argument
app.set('port', port);
// localize serialport object constructor
var SerialPort = serialport.SerialPort;

// object for each part of application
var Database = {
    datastore: new datastore({ filename: applicationPath + '/db/roboFeeder.db', autoload: true }),
    init: function(){
        // do nothing currently
        Log.log.info('Database', 'Database initialized', false);
    }
};
var Rfid = {
    // allowedTags uses strings to preserve leading zeros
    allowedTags: [],
    lastTrigger: null,
    init: function(){
        //read allowed tags from file
        Rfid.getAllowedTags();
        RoboFeeder.status.rfid = true;
        Log.log.info('Rfid', 'RFID initialized', false);
    },
    setLastTrigger: function(){
        var date = new Date();
        var unix_secs = date.getTime();
        Rfid.lastTrigger = unix_secs;
        Log.log.info('Rfid', 'Rfid.lastTrigger set: ' + unix_secs, false);
    },
    getAllowedTags: function(){
        Database.datastore.find(
            {
                type: 'tag',
                allowed: true
            },
            function (err, docs) {
                Rfid.allowedTags = [];
                if(typeof docs[0] != "undefined"){
                    for(var i=0; i < docs.length; i++){
                        Rfid.allowedTags.push(docs[i]['tag']);
                    }
                    Log.log.info('Rfid', 'Allowed tags loaded', false);
                }
                else{
                    // if no allowed tags loaded
                    Log.log.info('Rfid', 'No allowed tags loaded', false);
                }
            });
    },
    saveAllowedTag: function(tag){
        if(Rfid.allowedTags.indexOf(tag) === -1){
            Rfid.allowedTags.push(tag);
            allowedTagDoc = {
                type: 'tag',
                allowed: true,
                tag: tag
            };
            Database.datastore.insert(
                allowedTagDoc,
                function (err, newDoc) {   // Callback is optional
                    Log.log.info('Rfid', 'The new allowed tag ' + tag + ' was saved.');
                });
        }
        Log.log.warn('Rfid', 'The tag "' + tag + '" was already in the allowed tag list.');
    },
    removeAllowedTag: function(tag){
        var tagIndex = Rfid.allowedTags.indexOf(tag);
        if (tagIndex > -1) {
            Rfid.allowedTags.splice(tagIndex, 1);
            Database.datastore.remove(
                { tag: tag },
                {},
                function (err, numRemoved) {
                    Log.log.info('Rfid', 'The allowed tag ' + tag + ' was removed.');
                }
            );
        }
        Log.log.warn('Rfid', 'The tag ' + tag + ' was not in the allowed tags list to be removed.');
    }
};
var Motor = {
    reversePin: 16,
    forwardPin: 18,
    enablePin: 22,
    runTime: 2800,
    waitTime: 5000,
    running: false,
    init: function(){
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
            Log.log.info('Motor', 'Motor Pins setup', false);
            Log.log.info('Motor', 'Running initial open/close cycle without enabling PIR monitoring', false);
            RoboFeeder.cycle(false);
            RoboFeeder.status.motor = true;
            Log.log.info('Motor', 'Motor initialized', false);
        });
    },
    on: function(){
        //turns on the motor drive pin
        //needs to be called with Motor.forward or Motor.reverse to actually run motor
        if(!Motor.running){
            Motor.running = true;
            gpio.write(Motor.enablePin, true, function(err) {
                if (err) throw err;
            });
        }
    },
    off: function(){
        //turns all the way off all three pins involved
        Motor.running = false;
        gpio.write(Motor.enablePin, false, function(err) {
            if (err) throw err;
            Log.log.info('Motor', 'Motor.enablePin ' + Motor.enablePin + ' set LOW.', false);
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
            Log.log.info('Motor', 'Motor.forwardPin ' + Motor.forwardPin + ' set LOW.', false);
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
            Log.log.info('Motor', 'Motor.reversePin ' + Motor.reversePin + ' set LOW.', false);
        });
    },
    forward: function(){
        Motor.on();
        gpio.write(Motor.forwardPin, true, function(err) {
            if (err) throw err;
        });
        gpio.write(Motor.reversePin, false, function(err) {
            if (err) throw err;
        });
    },
    reverse: function(){
        Motor.on();
        gpio.write(Motor.reversePin, true, function(err) {
            if (err) throw err;
        });
        gpio.write(Motor.forwardPin, false, function(err) {
            if (err) throw err;
        });
    }
};
var Gpio = {
    init: function(){
        //bind change of GPIO pins
        Gpio.bindChange();
        Log.log.info('Gpio', 'GPIO initialized', false);
    },
    bindChange: function(){
        gpio.on('change', function(channel, value){
            //send monitoring data to server for monitor on site
            Log.log.info('Gpio', 'Channel ' + channel + ' value is now ' + value, false);
        });
    },
    closePins: function(){
        gpio.destroy(function() {
            Log.log.info('Gpio', '--- All pins un-exported, GPIO closed ---', false);
            return process.exit(0);
        });
    }
};
var Toolbox = {
    zeroFill: function(number, width){
        width -= number.toString().length;
        if ( width > 0 )    {
            return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
        }
        return number + ""; // always return a string
    }
};
var Serial = {
    sp: new SerialPort("/dev/ttyAMA0", {
        baudrate: 9600,
        parser: serialport.parsers.raw
    }),
    init: function(){
        Serial.sp.on('open', function() {
            Log.log.info('Serial', 'Serial connection open.', false);
            Serial.sp.on('data', function(data) {
                Serial.receiveData(data);
            });
        });
        RoboFeeder.status.serial = true;
    },
    receiveData: function(data){
        var buff = new Buffer(data, 'utf8');
        var encoded_hex = buff.toString('hex');
        var encoded_int = parseInt(encoded_hex, 16);
        Serial.checkCode(encoded_int, RoboFeeder.status.open);
    },
    checkCode: function(code, rechecking){
        var zerofilled_code = Toolbox.zeroFill(code, 8);
        var codeIndex = null;
        for(var i=0; i < Rfid.allowedTags.length; i++){
            if(Rfid.allowedTags[i] == zerofilled_code){
                codeIndex = i;
                break;
            }
        }
        if(codeIndex !== null){
            if(!rechecking){
                RoboFeeder.open();
                Pir.monitor();
            }
            Log.log.info('Serial', 'RFID tag match: ' + zerofilled_code);
            Rfid.setLastTrigger();
            //example code for checking for a specific tag, left in for later
            /* if(codeIndex === 0){
                //white tag index 0
            }
            else if(codeIndex === 1){
                //blue tag index 1
            }*/
        }
        else{
            Log.log.info('Serial', 'RFID tag not matched: ' + zerofilled_code);
        }
    }
};
var Pir = {
    // Passive InfraRed Sensor
    enablePin: 11,
    sensorPin: 12,
    lastTrigger: '',
    checkFrequency: 50,
    init: function(){
        async.parallel([
            function(callback){
                gpio.setup(Pir.enablePin, gpio.DIR_OUT, callback)
            },
            function(callback){
                gpio.setup(Pir.sensorPin, gpio.DIR_IN, callback)
            },
        ], function(err, results){
            Pir.enable();
            Pir.read();
            Pir.disable();
            RoboFeeder.status.pir = true;
            Log.log.info('Pir', 'PIR pins setup and sensor tested', false);
        });
    },
    enable: function(){
        gpio.write(Pir.enablePin, true, function(err) {
            if (err) throw err;
            Log.log.info('Pir', 'Pir.enablePin ' + Pir.enablePin + ' set HIGH', false);
        });
    },
    disable: function(){
        gpio.write(Pir.enablePin, false, function(err) {
            if (err) throw err;
            Log.log.info('Pir', 'Pir.enablePin ' + Pir.enablePin + ' set LOW', false);
        });
    },
    read: function(){
        gpio.read(Pir.sensorPin, function(err, value) {
            Log.log.info('Pir', 'The Pir sensor pin value is ' + value, false);
            return value;
        });
    },
    monitor: function(){
        Pir.enable();
        var ee = new process.EventEmitter(),
            pinState;

        ee.on('stateChange', function(previousValue, value){
            Log.log.info('Pir', 'PIR sensor pin state changed from ' + previousValue + ' to ' + value, false);
            Pir.setLastTrigger();
        });

        Pir.intervalTimer = setInterval(function(){
            gpio.read(Pir.sensorPin, function(err, value) {
                if(err){
                    ee.emit('error', err);
                }
                else{
                    if(pinState !== value){
                        var previousState = pinState;
                        pinState = value;
                        ee.emit('stateChange', previousState, value);
                    }
                }
            });
        }, Pir.checkFrequency);
    },
    monitorEnd: function(){
        Pir.disable();
        clearInterval(Pir.intervalTimer);
    },
    setLastTrigger: function(){
        var date = new Date();
        var unix_secs = date.getTime();
        Pir.lastTrigger = unix_secs;
        Log.log.info('Pir', 'Pir.lastTrigger set: ' + unix_secs, false);
    }
};
var Output = {
    // Status indication LEDs, etc.
    init: function(){
        // TODO
        Log.log.info('Output', 'Output init run', false);
    }
};
var Log = {
    log: log,
    items: [],
    init: function(){
        // setup event listener to save our npmlog events to the db log
        Log.log.on('log', function(stream){
            //if extra args not set or !== false then save log item to db log
            if(typeof stream.messageRaw[1] == "undefined" || (typeof stream.messageRaw[1] != "undefined" && stream.messageRaw[1] !== false)){
                Log.saveItem(stream);
            }
        });
        Log.load();
        Log.log.info('Log', 'Log initialized and log items loaded', false);
    },
    saveItem: function(stream){
        var date = new Date();
        var unix_secs = date.getTime();
        var logItem = {
            type: 'log',
            level: stream.level,
            category: stream.prefix,
            message: stream.messageRaw[0],
            timestamp: unix_secs
        };
        Database.datastore.insert(logItem, function (err, newDoc) {
            Log.log.info('Log', 'Log.saveItem success', false);
        });
    },
    load: function(){
        Database.datastore.find({type: 'log'}, function (err, docs) {
            if(typeof docs[0] != "undefined"){
                Log.items = [];
                for (var i=0; i < docs.length; i++) {
                    logItem = {
                        message: docs[i]['message'],
                        level: docs[i]['level'],
                        category: docs[i]['category'],
                        timestamp: docs[i]['timestamp']
                    };
                    Log.items.push(logItem);
                }
            }
        });
    },
    reset: function(){
        // Remove multiple documents
        Database.datastore.remove({ type: 'log' }, { multi: true }, function (err, numRemoved) {
            // newDoc is the newly inserted document, including its _id
            Log.log.info('Log', 'Log.reset - number of log items removed: ' + numRemoved, true);
            Log.items = [];
            return Log.items;
        });
    }
};
var RoboFeeder = {
    //for higher level functions and variables
    settings: {
        // set from db, configurable from ui
        //time in milliseconds, default to 10 seconds
        pirThreshold: '', // pir threshold for closing
        rfidThreshold: '' // rfid threshold for closing

    },
    defaultSettings: {
        rfidThreshold : 10000,
        pirThreshold : 10000
    },
    status: {
        open: false,
        pir: false,
        rfid: false,
        motor: false,
        serial: false
    },
    intervalTimer: '',
    openTimer: '',
    checkFrequency: 100,
    init: function(){
        async.parallel([
            function(){ Log.init(); },
            function(){ Gpio.init(); }
        ]);
        async.series({
            database_init: function (callback) {
                Database.init();
                callback(null, true);
            },
            roboFeeder_loadSetings: function(callback){
                RoboFeeder.loadSettings();
                callback(null, true);
            },
            rfid_init: function(callback){
                Rfid.init();
                callback(null, true);
            },
            serial_init: function(callback){
                Serial.init();
                callback(null, true);
            },
            pir_init: function(callback){
                Pir.init();
                callback(null, true);
            },
            motor_init: function(callback){
                Motor.init();
                callback(null, true);
            },
            output_init: function(callback){
                Output.init();
                callback(null, true);
            }
        }, function(err, results){
            if(!err){
                WebServer.init();
                Log.log.info('RoboFeeder', 'All startup processes initialized', true);
            }
        });
    },
    open: function(enable){
        //boolean `enable` is for enabling the pir sensor and log of the event being saved to the db log
        // `enable` is false during boot
        if(enable !== false){
            enable = true;
        }
        Log.log.info('RoboFeeder', 'Opening Tray', enable);
        Motor.reverse();
        RoboFeeder.status.open = true;
        RoboFeeder.openTimer = setTimeout(
            function(){ RoboFeeder.openCallback(enable); },
            Motor.runTime
        );
    },
    openCallback: function(enable){
        Motor.off();
        if(enable){
            Pir.monitor();
            RoboFeeder.monitor();
        }
    },
    close: function(enable){
        //boolean `enable` is for enabling the log of the event being saved to the db log
        // `enable` is false during boot, defaults to true after
        if(enable !== false){
            enable = true;
        }
        Log.log.info('RoboFeeder', 'Closing Tray', enable);
        Motor.forward();
        RoboFeeder.status.open = false;
        RoboFeeder.openTimer = setTimeout(
            RoboFeeder.closeCallback,
            Motor.runTime
        );
    },
    closeCallback: function(){
        Motor.off();
    },
    cycle: function(enable){
        if(enable !== false){
            enable = true;
        }
        RoboFeeder.open(enable);
        setTimeout(
            function(){RoboFeeder.close(enable)},
            Motor.waitTime
        );
    },
    loadSettings: function(){
        Database.datastore.find({type: 'setting'}, function (err, docs) {
            if(typeof docs[0] != "undefined"){
                var count = 0;
                for (var setting in RoboFeeder.settings) {
                    RoboFeeder.settings[setting] = docs[count]['value'];
                    count++;
                }
            }
            else{
                // if cannot get settings from db use default settings
                RoboFeeder.settings = RoboFeeder.defaultSettings;
            }
            Log.log.info('RoboFeeder', 'Settings loaded', false);
        });
    },
    saveSettings: function(req){
        RoboFeeder.settings = req.body.roboFeederSettings;
        for(var roboFeederSetting in RoboFeeder.settings){
            Database.datastore.update(
                { name: roboFeederSetting },
                { $set: { value: RoboFeeder.settings[roboFeederSetting] } },
                {},
                function (err, numReplaced) {
                Log.log.info('WebServer', 'Setting ' + roboFeederSetting + ' saved', false);
            }
            );
        }
        Log.log.info('WebServer', 'Settings saved');
    },
    monitor: function(){
        var ee = new process.EventEmitter(),
            rfid = false,
            pir = false;

        ee.on('stateChange', function(event_name){
            Log.log.info('RoboFeeder', 'roboFeeder monitor event emitter triggered: ' + event_name, false);
        });

        RoboFeeder.intervalTimer = setInterval(function(){
            var date = new Date();
            var unix_secs = date.getTime();

            if(unix_secs - RoboFeeder.settings.pirThreshold >= Pir.lastTrigger){
                if(!pir){
                    ee.emit('stateChange', 'PIR: past interval');
                    pir = true;
                }
            }
            else{
                if(pir){
                    ee.emit('stateChange', 'PIR: reset interval');
                    pir = false;
                }
            }
            if(unix_secs - RoboFeeder.settings.rfidThreshold >= Rfid.lastTrigger){
                if(!rfid){
                    ee.emit('stateChange', 'RFID: past interval');
                    rfid = true;
                }
            }
            else{
                if(rfid){
                    ee.emit('stateChange', 'RFID: reset interval');
                    rfid = false;
                }
            }
            if(pir && rfid){
                Pir.monitorEnd();
                RoboFeeder.monitorEnd();
                RoboFeeder.close();
            }
        }, RoboFeeder.checkFrequency);
    },
    monitorEnd: function(){
        clearInterval(RoboFeeder.intervalTimer);
    },
    openTimerEnd: function(){
        clearInterval(RoboFeeder.openTimer);
    }
};
var WebServer = {
    init: function(){
        app.set('views', applicationPath + '/views');
        app.set('view engine', 'jade');
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use(express.static(path.join(__dirname, 'public')));

        /** Routes */
        // serve index and view partials
        app.get('/', routes.index);
        app.get('/partials/:name', routes.partials);
        WebServer.setupApi();
        // redirect all others to the index (HTML5 history)
        app.get('*', routes.index);

        WebServer.create();
    },
    setupApi: function(){
        /** JSON API allows requests from front end to accomplish tasks */
        // tags
        app.get('/api/tags/allowed/get', function(req, res){
            return res.json({ allowedTags: Rfid.allowedTags });
        });
        app.post('/api/tags/allowed/add', function(req, res){
            if(typeof req.body.tag != "undefined"){
                Rfid.saveAllowedTag(req.body.tag);
            }
            return res.json({ allowedTags: Rfid.allowedTags });
        });
        app.post('/api/tags/allowed/remove', function(req, res){
            if(typeof req.body.tag != "undefined"){
                Rfid.removeAllowedTag(req.body.tag);
            }
            return res.json({ allowedTags: Rfid.allowedTags });
        });
        // manual open/close
        app.get('/api/open', function(req, res){
            RoboFeeder.openTimerEnd();
            RoboFeeder.open(false);
            RoboFeeder.openTimerEnd();
            setTimeout(
                function(){ return res.json({ status: RoboFeeder.status.open }); },
                Motor.runTime
            );
        });
        app.get('/api/close', function(req, res){
            RoboFeeder.openTimerEnd();
            RoboFeeder.close(false);
            RoboFeeder.openTimerEnd();
            setTimeout(
                function(){ return res.json({ status: RoboFeeder.status.open }); },
                Motor.runTime
            );
        });
        // statuses
        app.get('/api/status/open', function(req, res){
            return res.json({ status: RoboFeeder.status.open });
        });
        app.get('/api/status/pir', function(req, res){
            return res.json({ status: RoboFeeder.status.pir });
        });
        app.get('/api/status/rfid', function(req, res){
            return res.json({ status: RoboFeeder.status.rfid });
        });
        app.get('/api/status/motor', function(req, res){
            return res.json({ status: RoboFeeder.status.motor });
        });
        app.get('/api/status/serial', function(req, res){
            return res.json({ status: RoboFeeder.status.serial });
        });
        app.get('/api/status/load', function(req, res){
            return res.json({ statuses: RoboFeeder.status });
        });
        // settings
        app.get('/api/settings/get', function(req, res){
            return res.json({ roboFeederSettings: RoboFeeder.settings });
        });
        app.post('/api/settings/save', function(req, res){
            if(typeof req.body.roboFeederSettings != "undefined"){
                RoboFeeder.saveSettings(req);
            }
            return res.json({ roboFeederSettings: RoboFeeder.settings });
        });
        app.get('/api/settings/reset', function(req, res){
            RoboFeeder.settings = RoboFeeder.defaultSettings;
            return res.json({ roboFeederSettings: RoboFeeder.settings });
        });
        // log
        app.get('/api/log/get', function(req, res){
            return res.json({ log: Log.items });
        });
        app.get('/api/log/load', function(req, res){
            Log.load();
            return res.json({ log: Log.items });
        });
        app.get('/api/log/reset', function(req, res){
            Log.reset();
            return res.json({ log: Log.items });
        });
    },
    create: function(){
        var server = app.listen(port, ip, function () {
            var host = server.address().address;
            var port = server.address().port;
            Log.log.info('WebServer', 'RoboFeeder app listening at http://' + host + ':' + port, false);
        });
    }
};
// -- DO STUFF --
RoboFeeder.init();