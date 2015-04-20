'use strict';
/** Controllers */
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
angular.module('roboFeeder.controllers', ['ngAnimate']).
    controller('AppCtrl', function ($scope, $http, $resource, poller, $modal, $log, $filter) {
        $scope.status = {};
        $scope.errors = {};
        $scope.newTag = '';
        $scope.newTagName = '';
        $scope.log = [];
        $scope.removeTagSelect = {};
        $scope.roboFeederSettings = {};
        $scope.allowedTags = [];
        $scope.rules = [];
        $scope.newRule = {};
        $scope.msgs = {
            alreadyAllowed: false,
            removeSelectTag: false,
            notValidCode: false,
            newRule: {
                sameName: false,
                activateExpireDatetime: false,
                startEndTime: false,
                emptyField: false
            },
            editRule: {
                sameName: false,
                activateExpireDatetime: false,
                startEndTime: false,
                emptyField: false
            }

        };
        $scope.ruleTableHeaders = [
            'Name',
            'Weight',
            'Status',
            'Tag',
            'Start Time',
            'End Time',
            'Activate datetime',
            'Expire datetime',
            'Actions'
        ];
        $scope.datetime = {
            browserTZ: null,
            fields: [
                'start',
                'end',
                'activate',
                'expire'
            ],
            formats: {
                datetime: 'M/d/yy h:mm a',
                time: 'h:mm a'
            },
            datepicker: { // ui.bootstrap.datepicker
                datepickers: { // true == opened
                    rules: {
                        new:{
                            start: false,
                            end: false,
                            activate: false,
                            expire: false
                        },
                        edit: {
                            start: false,
                            end: false,
                            activate: false,
                            expire: false
                        }
                    }
                },
                examplePlaceholder: '4/15/15 7:17 PM',
                toggle: function($event, picker, type, ruleObj){
                    $event.preventDefault();
                    $event.stopPropagation();
                    if(type == 'new'){
                        if(picker == 'start' || picker == 'end'){
                            $scope.msgs.newRule.startEndTime = false;
                        }
                        else if(picker == 'activate' || picker == 'expire'){
                            $scope.msgs.newRule.activateExpireDatetime = false;
                        }
                    }
                    else{
                        // type == edit
                        // nothing currently
                        // TODO show validation messages
                    }
                    $scope.validateRule(ruleObj, type);

                    $scope.datetime.datepicker.datepickers.rules[type][picker] = !$scope.datetime.datepicker.datepickers.rules[type][picker];
                    $scope.datetime.timepicker.timepickers.rules[type][picker] = !$scope.datetime.timepicker.timepickers.rules[type][picker];
                }
            },
            timepicker: { // ui.bootstrap.timepicker
                timepickers: { // true == opened
                    rules: {
                        new: {
                            start: false,
                            end: false,
                            activate: false,
                            expire: false
                        },
                        edit: {
                            start: false,
                            end: false,
                            activate: false,
                            expire: false
                        }
                    }
                },
                examplePlaceholder: '7:17 PM',
                hstep: 1,
                mstep: 15,
                options: {
                    hstep: [1, 2, 3],
                    mstep: [1, 5, 10, 15, 25, 30]
                },
                ismeridian: true,
                toggleMode: function() {
                    $scope.datetime.timepicker.ismeridian = !$scope.datetime.timepicker.ismeridian;
                    if($scope.datetime.timepicker.ismeridian){
                        $scope.datetime.timepicker.examplePlaceholder = '7:17 PM';
                        $scope.datetime.datepicker.examplePlaceholder = '4/15/15 7:17 PM';
                        $scope.datetime.formats.datetime = 'M/d/yy h:mm a';
                        $scope.datetime.formats.time = 'h:mm a';
                    }
                    else{
                        $scope.datetime.timepicker.examplePlaceholder = '19:17';
                        $scope.datetime.datepicker.examplePlaceholder = '4/15/15 19:17';
                        $scope.datetime.formats.datetime = 'M/d/yy H:mm';
                        $scope.datetime.formats.time = 'H:mm';
                    }
                }
            },
            init: function(){
                $scope.datetime.browserTZ = $scope.datetime.getBrowserTimezone();
            },
            getBrowserTimezone: function(){
                var tz = jstz.determine(); // Determines the time zone of the browser client
                return tz.name(); // Returns the name of the time zone eg "Europe/Berlin"
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
            compare: function(a,b){
                // Source: http://stackoverflow.com/questions/497790
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
            dateFormatter: function(date){
                return $scope.datetime.formats.datetime;
            },
            timeFormatter: function(time){
                return $scope.datetime.formats.time;
            }
        };
        $scope.getAllowedTags = function(){
            $http.get('/api/tags/allowed/get').success(function( data ) {
                $scope.allowedTags = data.allowedTags;
            });
        };
        $scope.getStatuses = function(){
            $http.get('/api/status/open').success(function( data ) {
                $scope.status.open = data.status;
            });
            $http.get('/api/status/pir').success(function( data ) {
                $scope.status.pir = data.status;
            });
            $http.get('/api/status/rfid').success(function( data ) {
                $scope.status.rfid = data.status;
            });
            $http.get('/api/status/motor').success(function( data ) {
                $scope.status.motor = data.status;
            });
            $http.get('/api/status/serial').success(function( data ) {
                $scope.status.serial = data.status;
            });
        };
        $scope.statusPoller = function(){
            // Define your resource object.
            var logResource = $resource('/api/status/load');
            // Get poller. This also starts/restarts poller.
            var logPoller = poller.get(logResource, {
                catchError: true
            });
            // Update view. Since a promise can only be resolved or rejected once but we want
            // to keep track of all requests, poller service uses the notifyCallback. By default
            // poller only gets notified of success responses.
            logPoller.promise.then(null, null, function(data){$scope.statusPollerCallback(data)});
        };
        $scope.statusPollerCallback = function(result){
            // If catchError is set to true, this notifyCallback can contain either
            // a success or an error response.
            if (result.$resolved) {
                // Success handler ...
                $scope.status = result.statuses;
            } else {
                // Error handler: (data, status, headers, config)
                if (result.status === 503) {
                    // Stop poller or provide visual feedback to the user etc
                    poller.stopAll();
                }
            }
        };
        $scope.open = function(){
            $http.get('/api/open').success(function( data ) {
                $scope.status.open = data.status;
            });
        };
        $scope.close = function(){
            $http.get('/api/close').success(function( data ) {
                $scope.status.open = data.status;
            });
        };
        $scope.authorizeTag = function(){
            if(typeof $scope.newTag != "undefined" && $scope.newTag.length == 8){
                //check if tag already in allowedTags
                var filterObj = $scope.filterAllowedTags($scope.newTag);
                if(typeof filterObj.tagObj == "undefined"){
                    var tagObj = {
                        tag: $scope.newTag,
                        name: $scope.newTagName
                    };
                    $http.post('/api/tags/allowed/add', {tagObj: tagObj}).
                        success(function( data ) {
                            $scope.allowedTags = data.allowedTags;
                            $scope.newTag = '';
                            $scope.newTagName = '';
                        });
                }
                else{
                    //show message
                    $scope.msgs.alreadyAllowed = true;
                }
            }
            else{
                //show message
                $scope.msgs.notValidCode = true;
            }
        };
        $scope.removeTag = function(tag){
            var filterObj = $scope.filterAllowedTags(tag);
            if(typeof filterObj.tagObj != "undefined"){
                $http.post('/api/tags/allowed/remove', {tag: tag}).
                    success(function( data ) {
                        $scope.allowedTags = data.allowedTags;
                        $scope.removeTagSelect = {};
                    });
            }
            else{
                //show message
                $scope.msgs.removeSelectTag = true;
            }
        };
        $scope.getSettings = function(){
            $http.get('/api/settings/get').success(function( data ) {
                $scope.roboFeederSettings = data.roboFeederSettings;
            });
        };
        $scope.saveSettings = function(){
            $http.post('/api/settings/save', {roboFeederSettings: $scope.roboFeederSettings}).
                success(function( data ) {
                    $scope.roboFeederSettings = data.roboFeederSettings;
                });
        };
        $scope.resetSettings = function(){
            $http.get('/api/settings/reset').success(function( data ) {
                $scope.roboFeederSettings = data.roboFeederSettings;
            });
        };
        $scope.resetLog = function(){
            $http.get('/api/log/reset').success(function( data ) {
                $scope.log = data.items || [];
            });
        };
        $scope.logPoller = function(){
            // Define your resource object.
            var logResource = $resource('/api/log/load');
            // Get poller. This also starts/restarts poller.
            var logPoller = poller.get(logResource, {
                catchError: true
            });
            // Update view. Since a promise can only be resolved or rejected once but we want
            // to keep track of all requests, poller service uses the notifyCallback. By default
            // poller only gets notified of success responses.
            logPoller.promise.then(null, null, function(data){$scope.logPollerCallback(data)});
        };
        $scope.logPollerCallback = function(result){
            // If catchError is set to true, this notifyCallback can contain either
            // a success or an error response.
            if (result.$resolved) {
                // Success handler ...
                $scope.log = result.log;
            } else {
                // Error handler: (data, status, headers, config)
                if (result.status === 503) {
                    // Stop poller or provide visual feedback to the user etc
                    poller.stopAll();
                }
            }
        };
        $scope.getRules = function(){
            $http.get('/api/rules/get').success(function( data ) {
                $scope.rules = data.rules;
            });
        };
        $scope.saveEditedRule = function(ruleObj){
            delete ruleObj.editing;
            $http.post('/api/rules/edit', {ruleObj: ruleObj}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
        };
        $scope.removeRule = function(ruleObj){
            $http.post('/api/rules/remove', {rule: ruleObj}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
        };
        $scope.editRule = function(ruleObj){
            // use angular.copy to clone the ruleObj to prevent binding
            $scope.editedRule = angular.copy(ruleObj);
            $scope.editedRule.newName = ruleObj.name;
        };
        $scope.cancelEdit = function(){
            delete $scope.editedRule;
        };
        $scope.resetRules = function(){
            $http.get('/api/rules/reset').success(function( data ) {
                $scope.rules = data.rules;
            });
        };
        $scope.filterAllowedTags = function(tag){
            var tagIndex = null;
            var tagObj = $scope.allowedTags.filter(function ( obj, index ) {
                if(obj.tag === tag){
                    tagIndex = index;
                }
                return obj.tag === tag;
            })[0];
            return {tagIndex: tagIndex, tagObj: tagObj};
        };
        $scope.tagObjName = function(tagObj){
            if(typeof tagObj.name == "undefined" || tagObj.name == ''){
                return tagObj.tag;
            }
            return tagObj.name + ' : ' + tagObj.tag;
        };
        $scope.ruleTypeValue = function(ruleObj, ruleType){
            return ruleObj.rule[ruleType];
        };
        $scope.createRule = function(){
            if($scope.validateRule($scope.newRule, 'new')){
                // page handles basic validation (is this filled in, correct data type)
                $http.post('/api/rules/save', {newRule: $scope.newRule}).
                    success(function( data ) {
                        $scope.newRuleInitialize();
                        $scope.rules = data.rules;
                    });
            }
        };
        $scope.validateRule = function(ruleObj, type){
            $scope.errors = {};
            // validates the date and time ranges in the rule
            if(
                ruleObj.rule.activate === null ||
                ruleObj.rule.expire === null ||
                ruleObj.rule.start === null ||
                ruleObj.rule.end === null
            ){
                $scope.errors.empty = [];
                if(ruleObj.rule.activate === null){
                    $scope.errors.empty.push('activate');
                }
                if(ruleObj.rule.expire === null){
                    $scope.errors.empty.push('expire');
                }
                if(ruleObj.rule.start === null){
                    $scope.errors.empty.push('start');
                }
                if(ruleObj.rule.end === null){
                    $scope.errors.empty.push('end');
                }
            }
            // if datetimes not null check if range is valid
            if(ruleObj.rule.activate !== null && ruleObj.rule.expire !== null){
                if($scope.validateActivateExpireRange(ruleObj.rule.activate, ruleObj.rule.expire)){
                    $scope.errors['activateExpireDatetime'] = true;
                }
            }
            // if times not null check if range is valid
            if(ruleObj.rule.start !== null && ruleObj.rule.end !== null){
                var startEndTime = $scope.validateStartEndRange(ruleObj.rule.start, ruleObj.rule.end);
                if(!startEndTime){
                    $scope.errors['startEndTime'] = true;
                }
            }
            // check if rule name is unique
            if(ruleObj.name != ''){
                for(var i=0; i<$scope.rules.length;i++){
                    if ($scope.rules[i].name === ruleObj.name) {
                        $scope.errors['sameName'] = true;
                    }
                }
            }
            // error display messages
            var msgType = 'newRule';
            if(type == 'edit'){
                msgType = 'editRule';
            }
            $scope.msgs[msgType].emptyField = false;
            // no errors
            if($scope.errorsSize() === 0){
                return true;
            }
            else{
                // activate errors in DOM
                for(var i=0; i<Object.size($scope.errors); i++){
                    if(typeof $scope.errors['activateExpireDatetime'] != "undefined" && $scope.errors['activateExpireDatetime']){
                        $scope.msgs[msgType].activateExpireDatetime = true;
                    }
                    if(typeof $scope.errors['startEndTime'] != "undefined" && $scope.errors['startEndTime']){
                        $scope.msgs[msgType].startEndTime = true;
                    }
                    if(typeof $scope.errors['empty'] != "undefined" && $scope.errors['empty']){
                        $scope.msgs[msgType].emptyField = true;
                    }
                    if(typeof $scope.errors['sameName'] != "undefined" && $scope.errors['sameName']){
                        $scope.msgs[msgType].sameName = true;
                    }
                }
            }
            return false;
        };
        $scope.validateActivateExpireRange = function(activate, expire){
            // validates datetimes: activate is <= expire
            var compareReturnValue = $scope.datetime.compare(activate, expire);
            if(compareReturnValue === 1){
                return true;
            }
            return false;
        };
        $scope.validateStartEndRange = function(start, end){
            // validates time only
            // start is <= end returns true
            start = new Date(start);
            end = new Date(end);
            var start_hour = start.getHours();
            var end_hour = end.getHours();
            var start_min = start.getMinutes();
            var end_min = end.getMinutes();

            if(start_hour < end_hour){
                return true;
            }
            else if(start_hour == end_hour){
                if(start_min <= end_min){
                    return true;
                }
            }
            return false;
        };
        $scope.newRuleInitialize = function(){
            $scope.newRule = {
                type: 'rule',
                name: '',
                weight: 0,
                active: true,
                browserTZ: $scope.datetime.browserTZ,
                rule: {
                    tag: '',
                    start: null,
                    end: null,
                    activate: null,
                    expire: null
                }
            };
        };
        $scope.createRuleOptionsModal = function(size) {
            $modal.open({
                templateUrl: 'createRuleOptionsModal',
                controller: 'ModalRuleOptionsCtrl',
                size: size,
                resolve: {
                    datetime: function(){
                        return $scope.datetime;
                    }
                }
            });
        };
        $scope.createRuleEditModal = function(ruleObj, size) {
            $scope.editRule(ruleObj);
            $modal.open({
                templateUrl: 'createRuleEditModal',
                controller: 'ModalRuleEditCtrl',
                scope: $scope,
                size: size,
                resolve: {
                    ruleObj: function(){
                        return ruleObj;
                    }
                }
            });
        };
        $scope.errorsSize = function(){
            // returns boolean
            return Object.size($scope.errors);
        };
        $scope.ruleActiveString = function(status){
            return status ? 'Active' : 'Disabled';
        };
        $scope.init = function(){
            $scope.getStatuses();
            $scope.getAllowedTags();
            $scope.logPoller();
            $scope.statusPoller();
            $scope.getSettings();
            $scope.datetime.init();
            $scope.newRuleInitialize();
            $scope.getRules();
        };
        // do stuff
        $scope.init();
    }).
    controller('ModalRuleOptionsCtrl', function ($scope, $modalInstance, datetime) {
        $scope.datetime = datetime;
        $scope.ok = function () {
            $modalInstance.close();
        };
        $scope.toggleMode = function() {
            $scope.datetime.timepicker.ismeridian = !$scope.datetime.timepicker.ismeridian;
            if($scope.datetime.timepicker.ismeridian){
                $scope.datetime.timepicker.examplePlaceholder = '7:17 PM';
                $scope.datetime.datepicker.examplePlaceholder = '4/15/15 7:17 PM';
            }
            else{
                $scope.datetime.timepicker.examplePlaceholder = '19:17';
                $scope.datetime.datepicker.examplePlaceholder = '4/15/15 19:17';
            }
        };
    }).
    controller('ModalRuleEditCtrl', function ($scope, $modalInstance, ruleObj) {
        $scope.ruleObj = ruleObj;
        $scope.ok = function () {
            $scope.ruleObj = $scope.editedRule;
            $scope.saveEditedRule($scope.ruleObj);
            $modalInstance.close();
        };
        $scope.cancel = function () {
            $scope.cancelEdit();
            $modalInstance.dismiss('cancel');
        };
    });