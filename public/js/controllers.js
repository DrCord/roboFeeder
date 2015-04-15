'use strict';
/** Controllers */
angular.module('roboFeeder.controllers', []).
    controller('AppCtrl', function ($scope, $http, $resource, poller) {
        $scope.status = {};
        $scope.errors = [];
        $scope.newTag = '';
        $scope.newTagName = '';
        $scope.log = [];
        $scope.removeTagSelect = {};
        $scope.roboFeederSettings = {};
        $scope.allowedTags = [];
        $scope.rules = [
            // test rules
            {
                type: 'rule',
                name: 'test rule 1',
                weight: 2,
                active: true,
                rule: {
                    tag: 12345678,
                    start: 1428981715000,
                    end: 1428981715000,
                    activate: 1428981715000,
                    expire: 1428981715000
                }
            },
            {
                type: 'rule',
                name: 'test rule 2',
                weight: 3,
                active: true,
                rule: {
                    tag: 55547454,
                    start: 1428981715000,
                    end: 1428981715000,
                    activate: 1428981715000,
                    expire: 1428981715000
                }
            },
            {
                type: 'rule',
                name: 'test rule 3',
                weight: 1,
                active: false,
                rule: {
                    tag: 87654321,
                    start: 1428981795000,
                    end: 1428981795000,
                    activate: 1428981795000,
                    expire: 1428981795000
                }
            }
        ];
        $scope.newRule = {
            type: 'rule',
            name: '',
            weight: 0,
            active: true,
            rule: {
                tag: '',
                start: null,
                end: null,
                activate: null,
                expire: null
            }
        };
        $scope.selectedRule = {};
        $scope.msgs = {
            alreadyAllowed: false,
            removeSelectTag: false,
            notValidCode: false,
            ruleSameName: false
        };
        // functions
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
        $scope.saveRule = function(){
            $http.post('/api/rules/save', {rule: $scope.newRule}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
        };
        $scope.removeRule = function(){
            $http.post('/api/rules/remove', {rule: $scope.selectedRule}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
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

        /** https://angular-ui.github.io/bootstrap */
        $scope.datetime = {
            examplePlaceholder: '4/15/15 7:17 PM',
            datepicker: { // ui.bootstrap.datepicker
                datepickers: { //opened
                    start: false,
                    end: false,
                    activate: false,
                    expire: false
                },
                toggle: function($event, picker){
                    $event.preventDefault();
                    $event.stopPropagation();
                    $scope.datetime.datepicker.datepickers[picker] = !$scope.datetime.datepicker.datepickers[picker];
                    $scope.datetime.timepicker.timepickers[picker] = !$scope.datetime.timepicker.timepickers[picker];
                }
            },
            timepicker: { // ui.bootstrap.timepicker
                timepickers: { //opened
                    start: false,
                    end: false,
                    activate: false,
                    expire: false
                },
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
                        $scope.datetime.examplePlaceholder = '4/15/15 7:17 PM';
                    }
                    else{
                        $scope.datetime.examplePlaceholder = '4/15/15 19:17';
                    }
                }
            },
            now: function() {
                // TODO - setup polling this function to refresh dt for status page
                // current datetime on init, used on status page
                $scope.dt = new Date();
            }
        };

        $scope.init = function(){
            $scope.getStatuses();
            $scope.getAllowedTags();
            $scope.logPoller();
            $scope.statusPoller();
            $scope.getSettings();
            $scope.datetime.now();
        };

        // do stuff
        $scope.init();
    });