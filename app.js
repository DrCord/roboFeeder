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
    moment = require('moment-timezone'),
    path = require('path'),
    piblaster = require('pi-blaster.js'),
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
        async.forever(
            function(next) {
                // next is suitable for passing to things that need a callback(err [, whatever]);
                // it will result in this function being called again.
                Database.datastore.find(
                    {
                        type: 'tag',
                        allowed: true
                    },
                    function (err, docs) {
                        Rfid.allowedTags = [];
                        if(typeof docs[0] != "undefined"){
                            for(var i=0; i < docs.length; i++){
                                var tag = {
                                    tag: docs[i]['tag'],
                                    name: docs[i]['name']
                                };
                                Rfid.allowedTags.push(tag);
                            }
                            Log.log.info('Rfid', 'Allowed tags loaded', false);
                        }
                        else{
                            // if no allowed tags loaded
                            Log.log.info('Rfid', 'No allowed tags loaded', false);
                        }
                    });
            },
            function(err) {
                // if next is called with a value in its first parameter, it will appear
                // in here as 'err', and execution will stop.
            }
        );
    },
    saveAllowedTag: function(tagObj){
        var tag = tagObj.tag;
        var filterObj = Rfid.filterAllowedTags(tagObj.tag);
        if(typeof filterObj.tagObj == "undefined"){
            var allowedTagDoc = {
                type: 'tag',
                allowed: true,
                tag: tagObj.tag,
                name: tagObj.name
            };
            Rfid.allowedTags.push({tag: tagObj.tag, name: tagObj.name});
            Database.datastore.update(
                {tag: tagObj.tag},
                allowedTagDoc,
                {upsert: true},
                function (err, newDoc) {   // Callback is optional
                    Log.log.info('Rfid', 'The new allowed tag ' + tag + ' was saved.');
                }
            );
        }
        else{
            Log.log.warn('Rfid', 'The tag "' + tag + '" was already in the allowed tag list.');
        }
    },
    removeAllowedTag: function(tag){
        var filterObj = Rfid.filterAllowedTags(tag);
        if (typeof filterObj.tagObj != "undefined") {
            Rfid.allowedTags.splice(filterObj.tagIndex, 1);
            Database.datastore.remove(
                { tag: tag },
                {},
                function (err, numRemoved) {
                    Log.log.info('Rfid', 'The allowed tag ' + tag + ' was removed.');
                }
            );
        }
        else{
            Log.log.warn('Rfid', 'The tag ' + tag + ' was not in the allowed tags list to be removed.');
        }
    },
    loadTag: function(tag){
        var filterObj = Rfid.filterAllowedTags(tag);
        return filterObj.tagObj;
    },
    filterAllowedTags: function(tag){
        var tagIndex = null;
        var tagObj = Rfid.allowedTags.filter(function ( obj, index ) {
            if(obj.tag === tag){
                tagIndex = index;
            }
            return obj.tag === tag;
        })[0];
        return {tagIndex: tagIndex, tagObj: tagObj};
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
    datetime: {
        dt: null,
        now: function(){
            return new Date();
        },
        newDT: function(){
            Toolbox.datetime.dt = Toolbox.datetime.now();
        },
        convert: function(d){ // Source: http://stackoverflow.com/questions/497790
            // Converts the date in d to a date-object. The input can be:
            //   a date object: returned without modification
            //  an array      : Interpreted as [year,month,day]. NOTE: month is 0-11.
            //   a number     : Interpreted as number of milliseconds
            //                  since 1 Jan 1970 (a timestamp)
            //   a string     : Any format supported by the javascript engine, like
            //                  "YYYY/MM/DD", "MM/DD/YYYY", "Jan 31 2009" etc.
            //  an object     : Interpreted as an object with year, month and date
            //                  attributes.  **NOTE** month is 0-11.
            return (
                d.constructor === Date ? d :
                    d.constructor === Array ? new Date(d[0],d[1],d[2]) :
                        d.constructor === Number ? new Date(d) :
                            d.constructor === String ? new Date(d) :
                                typeof d === "object" ? new Date(d.year,d.month,d.date) :
                                    NaN
            );
        },
        compare: function(a,b){ // Source: http://stackoverflow.com/questions/497790
            // Compare two dates (could be of any type supported by the convert
            // function above) and returns:
            //  -1 : if a < b
            //   0 : if a = b
            //   1 : if a > b
            // NaN : if a or b is an illegal date
            // NOTE: The code inside isFinite does an assignment (=).
            return (
                isFinite(a=this.convert(a).valueOf()) &&
                isFinite(b=this.convert(b).valueOf()) ?
                (a>b)-(a<b) :
                    NaN
            );
        },
        inDateRange: function(d, start, end){ // Source: http://stackoverflow.com/questions/497790
            // Checks if date in d is between dates in start and end.
            // Returns a boolean or NaN:
            //    true  : if d is between start and end (inclusive)
            //    false : if d is before start or after end
            //    NaN   : if one or more of the dates is illegal.
            // NOTE: The code inside isFinite does an assignment (=).
            return (
                isFinite(d=this.convert(d).valueOf()) &&
                isFinite(start=this.convert(start).valueOf()) &&
                isFinite(end=this.convert(end).valueOf()) ?
                start <= d && d <= end :
                    NaN
            );
        },
        inTimeRange: function(start, end, tz){
            // Checks if current date's time (hours, minutes) is between dates in start and end time values
            // ignores non-time portion of start and end datetimes.
            // Returns a boolean

            tz = tz || 'America/Los_Angeles';
            // set all dates to the same timezone to allow calculations to not be insane
            var d = moment(new Date()).tz(tz);
            start = moment(this.convert(start)).tz(tz);
            end = moment(this.convert(end)).tz(tz);

            var d_hour = parseInt(d.format('H'));
            var d_minute = parseInt(d.format('mm'));
            var start_hour = parseInt(start.format('H'));
            var start_minute = parseInt(start.format('mm'));
            var end_hour = parseInt(end.format('H'));
            var end_minute = parseInt(end.format('mm'));

            if( (start_hour < d_hour) && (d_hour < end_hour) ){
                return true;
            }
            else if(start_hour == d_hour){
                if(start_minute <= d_minute){
                    return true;
                }
            }
            else if(end_hour == d_hour){
                if(d_minute <= end_minute){
                    return true;
                }
            }
            return false;
        }
    },
    init: function(){
        Toolbox.datetime.newDT();
        Log.log.info('Toolbox', 'Toolbox initialized and datetime created', false);
    },
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
                var encoded_int = Serial.receiveData(data);
                RoboFeeder.codeResponse(encoded_int);
            });
        });
        RoboFeeder.status.serial = true;
    },
    receiveData: function(data){
        var buff = new Buffer(data, 'utf8');
        var encoded_hex = buff.toString('hex');
        var encoded_int = parseInt(encoded_hex, 16);
        return encoded_int;
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
        Database.datastore.remove({ type: 'log' }, { multi: true }, function (err, numRemoved) {
            // newDoc is the newly inserted document, including its _id
            Log.log.info('Log', 'Log.reset - number of log items removed: ' + numRemoved, true);
            Log.items = [];
            return Log.items;
        });
    }
};
var Rules = {
    /** rules object definition
     *  {
            type: string 'rule',
            name: unique string *user input*,
            weight: int,
            active: boolean,
            rule: {
                    tag: int 8,
                    start: int timestamp,
                    end: int timestamp,
                    activate: int timestamp,
                    expire: int timestamp
                }
        }
     */
    rules: [],
    init: function(){
        Rules.load();
        Log.log.info('Rules', 'Rules initialized and rule items loaded', false);
    },
    load: function(){
        Database.datastore.find({type: 'rule'}, function (err, docs) {
            if(typeof docs[0] != "undefined"){
                Rules.rules = docs;
            }
        });
    },
    get: function(){
        return Rules.rules;
    },
    save: function(ruleObj){
        Rules.rules.push(ruleObj);
        Database.datastore.update(
            {
                type: 'rule',
                name: ruleObj.name
            },
            ruleObj,
            {upsert: true},
            function (err, newDoc) {   // Callback is optional
                Log.log.info('Rules', 'Rules.save - rule ' + ruleObj.name + ' saved.', true);
            }
        );
    },
    edit: function(ruleObj){
        var filterObj = Rules.filterRules(ruleObj, 'name');
        var oldName = null;
        if(typeof ruleObj.newName != "undefined"){
            var oldName = ruleObj.name;
            ruleObj.name = ruleObj.newName;
            delete ruleObj.newName;
        }
        if(typeof filterObj.ruleIndex != "undefined"){
            Rules.rules[filterObj.ruleIndex] = ruleObj;
            Database.datastore.update(
                {
                    type: 'rule',
                    name: (oldName === null ? ruleObj.name : oldName)
                },
                ruleObj,
                {},
                function (err, newDoc) {   // Callback is optional
                    Log.log.info('Rules', 'Rules.edit - rule ' + ruleObj.name + ' saved.', true);
                }
            );
        }
    },
    remove: function(rule){
        var filterObj = Rules.filterRules(rule, 'name');
        if (typeof filterObj.ruleObj != "undefined") {
            Rules.rules.splice(filterObj.ruleIndex, 1);
            Database.datastore.remove(
                {
                    type: 'rule',
                    name: rule.name
                },
                {},
                function (err, numRemoved) {
                    Log.log.info('Rules', 'The rule "' + rule.name + '" was removed.');
                }
            );
        }
        else{
            Log.log.warn('Rules', 'The rule "' + rule.name + '" was not in the rules list to be removed.');
        }
    },
    reset: function(){
        Database.datastore.remove({ type: 'rule' }, { multi: true }, function (err, numRemoved) {
            // newDoc is the newly inserted document, including its _id
            Log.log.info('Rules', 'Rules.reset - number of rule items removed: ' + numRemoved, true);
            Rules.rules = [];
            return Rules.rules;
        });
    },
    filterRules: function(rule, field){
        var ruleIndex = null;
        var ruleObj = Rules.rules.filter(function ( obj, index ) {
            if(obj[field] === rule[field]){
                ruleIndex = index;
            }
            return obj[field] === rule[field];
        })[0];
        return {ruleIndex: ruleIndex, ruleObj: ruleObj};
    },
    isWithinActiveDatePeriod: function(ruleObj){
        return Toolbox.datetime.inDateRange(Toolbox.datetime.now(), ruleObj.rule.activate, ruleObj.rule.expire);
    },
    isWithinActiveTimePeriod: function(ruleObj){
        return Toolbox.datetime.inTimeRange(ruleObj.rule.start, ruleObj.rule.end, Toolbox.datetime.browserTZ);

    },
    status: function(ruleObj){
        return ruleObj.active;
    },
    codeRuleIndexes: function(codeIndex){
        var ruleIndexes = [];
        for(var i=0; i<Rules.rules.length; i++){
            if(Rules.rules[i].rule.tag == Rfid.allowedTags[codeIndex].tag){
                ruleIndexes.push(i);
            }
        }
        return ruleIndexes;
    },
    isActive: function(ruleObj){
        if(Rules.status( ruleObj )) {
            if (Rules.isWithinActiveDatePeriod(ruleObj)) {
                if (Rules.isWithinActiveTimePeriod(ruleObj)) {
                    return true;
                }
            }
        }
        return false;
    }/*,
    isAnyRuleActive: function(){
        for(var i=0; i<Rules.rules.length; i++){
            if(Rules.isActive(Rules.rules[i])){
                return true;
            }
        }
        return false;
    }*/
};
var Servo = {
    // for status indicator flag
    pin: 23,
    position: { // percent of pwm to enable, servos run on pwm pulse length to determine position
        start: 0.07,
        end: 0.20
    },
    stopTimeout: 0,
    cycleTimeout: 0,
    intervalTimer: 0,
    checkFrequency: 5000,
    init: function(){
        Servo.test();
        Servo.monitor();
        RoboFeeder.status.flagManualMode = false;
    },
    move: function(pwm_percent){
        piblaster.setPwm(Servo.pin, pwm_percent, Servo.stop);
    },
    lowerFlag: function(){
        if(RoboFeeder.status.flag){
            Log.log.info('Servo', 'Flag lowered.', false);
            // set to start position
            Servo.move(Servo.position.end);
            RoboFeeder.status.flag = false;
        }
    },
    raiseFlag: function(){
        if(!RoboFeeder.status.flag){
            Log.log.info('Servo', 'Flag raised.', false);
            // set to end position
            Servo.move(Servo.position.start);
            RoboFeeder.status.flag = true;
        }
    },
    stop: function(){
        clearTimeout(Servo.stopTimeout);
        // uses timeout to make sure servo is finished moving before stopping
        Servo.stopTimeout = setTimeout(
            function(){
                piblaster.setPwm(Servo.pin, 0);
            }, 1000);
    },
    cycle: function(timeout){
        clearTimeout(Servo.cycleTimeout);
        Servo.raiseFlag();
        Servo.cycleTimeout = setTimeout( function(){
            Servo.lowerFlag();
        }, timeout);
    },
    test: function(){
        Log.log.info('Servo', 'Servo initialization test running.', false);
        if(!RoboFeeder.status.servo){
            Servo.stop();
            setTimeout( function(){
                Servo.cycle(5000);
                RoboFeeder.status.servo = true;
                Log.log.info('Servo', 'Servo initialization test finished.', false);
            }, 1200);
        }
    },
    monitor: function(){
        Servo.intervalTimer = setInterval(
            function(){
                if(!RoboFeeder.status.flagManualMode){
                    if(RoboFeeder.isAnyCodeAllowed()){
                        Servo.raiseFlag();
                    }
                    else{
                        Servo.lowerFlag();
                    }
                }
            }, Servo.checkFrequency
        );
    },
    monitorEnd: function(){ // currently unused
        clearInterval(Servo.intervalTimer);
    },
    setManualMode: function(manualMode){
        RoboFeeder.status.flagManualMode = manualMode;
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
        serial: false,
        flag: false,
        servo: false,
        flagManualMode: false
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
            rules_init: function(callback){
                Rules.init();
                callback(null, true);
            },
            output_init: function(callback){
                Output.init();
                callback(null, true);
            },
            toolbox_init: function(callback){
                Toolbox.init();
                callback(null, true);
            },
            servo_init: function(callback){
                Servo.init();
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
        // make sure to kill any previous timer
        RoboFeeder.openTimerEnd();
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
        // make sure to kill any previous timer
        RoboFeeder.openTimerEnd();
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
    },
    checkCode: function(code){
        // returns null if not found instead of zero, since 0 could be an index
        // make sure to use codeIndex !== null when checking returned value to see if a code matched
        var zerofilled_code = Toolbox.zeroFill(code, 8);
        var codeIndex = null;
        for(var i=0; i < Rfid.allowedTags.length; i++){
            if(Rfid.allowedTags[i].tag == zerofilled_code){
                codeIndex = i;
                break;
            }
        }
        return codeIndex;
    },
    codeResponse: function(code){
        var codeIndex = RoboFeeder.checkCode(code);
        // has allowed code
        if(codeIndex !== null){
            // check if has rule(s) for allowed code
            var ruleIndexes = Rules.codeRuleIndexes(codeIndex);
            if(ruleIndexes.length > 0){
                for(var j=0; j<ruleIndexes.length; j++){
                    // check if rule is in valid period between activation and expiration                    
                    if(Rules.isActive( Rules.rules[ruleIndexes[j]] )){
                        // if matching rule is fully active
                        Log.log.info('RoboFeeder', 'RFID allowed tag rule "' + Rules.rules[ruleIndexes[j]].name + '" found and fully active: tag "' + Rfid.allowedTags[codeIndex].tag + '" authorized', true);
                        RoboFeeder.tagMatch(codeIndex);
                        return true;
                    }
                    else{
                        // matching rule(s) not fully active
                        Log.log.info('RoboFeeder', 'RFID allowed tag rule "' + Rules.rules[ruleIndexes[j]].name + '" found but NOT active: tag "' + Rfid.allowedTags[codeIndex].tag + '" NOT authorized', true);
                    }
                }
            }
            else{
                // if no matching rules - open with allowed code at any time
                RoboFeeder.tagMatch(codeIndex);
                Log.log.info('RoboFeeder', 'RFID allowed tag has no rules: tag "' + Rfid.allowedTags[codeIndex].tag + '" authorized.', true);
                return true;
            }
        }
        else{
            Log.log.info('RoboFeeder', 'RFID tag not matched: ' + Toolbox.zeroFill(code, 8));
        }
        return false;
    },
    codeAllowed: function(code){
        var codeIndex = RoboFeeder.checkCode(code);
        // has allowed code
        if(codeIndex !== null){
            // check if has rule(s) for allowed code
            var ruleIndexes = Rules.codeRuleIndexes(codeIndex);
            if(ruleIndexes.length > 0){
                for(var j=0; j<ruleIndexes.length; j++){
                    // check if rule is in valid period between activation and expiration
                    if(Rules.isActive( Rules.rules[ruleIndexes[j]] )){
                        // if matching rule is fully active
                        return true;
                    }
                    else{
                        // matching rule(s) not fully active
                        return false;
                    }
                }
            }
            else{
                // if no matching rules - open with allowed code at any time
                return true;
            }
        }
        else{
            // no match
            return false;
        }
    },
    isAnyCodeAllowed: function(){
        for(var i=0; i<Rfid.allowedTags.length; i++){
            if(RoboFeeder.codeAllowed(Rfid.allowedTags[i])){
                return true;
            }
        }
        return false;
    },
    tagMatch: function(codeIndex){
        if(!RoboFeeder.status.open){
            RoboFeeder.open();
            Pir.monitor();
        }
        if(typeof Rfid.allowedTags[codeIndex].name != "undefined"){
            Log.log.info('RoboFeeder', 'RFID tag match - ' + Rfid.allowedTags[codeIndex].name + ': ' + Rfid.allowedTags[codeIndex].tag);
        }
        else{
            Log.log.info('RoboFeeder', 'RFID tag match: ' + Rfid.allowedTags[codeIndex].tag);
        }
        Rfid.setLastTrigger();
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
            if(typeof req.body.tagObj != "undefined"){
                Rfid.saveAllowedTag(req.body.tagObj);
            }
            return res.json({ allowedTags: Rfid.allowedTags });
        });
        app.post('/api/tags/allowed/remove', function(req, res){
            if(typeof req.body.tag != "undefined"){
                Rfid.removeAllowedTag(req.body.tag);
            }
            return res.json({ allowedTags: Rfid.allowedTags });
        });
        app.post('/api/tags/name/get', function(req, res){
            var tagObj = Rfid.loadTag(req.body.tag);
            return res.json({ name: tagObj.name });
        });
        // manual open/close
        app.get('/api/open', function(req, res){
            RoboFeeder.open(false);
            RoboFeeder.openTimerEnd();
            setTimeout(
                function(){ return res.json({ status: RoboFeeder.status.open }); },
                Motor.runTime
            );
        });
        app.get('/api/close', function(req, res){
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
        app.get('/api/status/flag/position', function(req, res){
            return res.json({ statuses: RoboFeeder.status.flag });
        });
        app.get('/api/status/flag/mode', function(req, res){
            return res.json({ status: RoboFeeder.status.flagManualMode });
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
        // rules
        app.get('/api/rules/get', function(req, res){
            return res.json({ rules: Rules.rules });
        });
        app.post('/api/rules/save', function(req, res){
            if(typeof req.body.newRule != "undefined"){
                Rules.save(req.body.newRule);
            }
            return res.json({ rules: Rules.rules });
        });
        app.post('/api/rules/edit', function(req, res){
            if(typeof req.body.ruleObj != "undefined"){
                Rules.edit(req.body.ruleObj);
            }
            return res.json({ rules: Rules.rules });
        });
        app.post('/api/rules/remove', function(req, res){
            if(typeof req.body.rule != "undefined"){
                Rules.remove(req.body.rule);
            }
            return res.json({ rules: Rules.rules });
        });
        app.get('/api/rules/reset', function(req, res){
            Rules.reset();
            return res.json({ rules: Rules.rules });
        });
        // servo/flag
        app.get('/api/flag/raise', function(req, res){
            if(!RoboFeeder.status.flag){
                Servo.raiseFlag();
            }
            return res.json({ status: RoboFeeder.status.flag });
        });
        app.get('/api/flag/lower', function(req, res){
            if(RoboFeeder.status.flag){
                Servo.lowerFlag();
            }
            return res.json({ status: RoboFeeder.status.flag });
        });
        app.get('/api/flag/mode/manual', function(req, res){
            Servo.setManualMode(true);
            return res.json({ status: RoboFeeder.status.flagManualMode });
        });
        app.get('/api/flag/mode/auto', function(req, res){
            Servo.setManualMode(false);
            return res.json({ status: RoboFeeder.status.flagManualMode });
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
