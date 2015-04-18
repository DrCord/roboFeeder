'use strict';
/** Controllers */
angular.module('roboFeeder.controllers', ['ngAnimate']).
    controller('AppCtrl', function ($scope, $http, $resource, poller, $modal, $log) {
        $scope.status = {};
        $scope.errors = [];
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
            ruleSameName: false
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
            datepicker: { // ui.bootstrap.datepicker
                datepickers: { // true == opened
                    start: false,
                    end: false,
                    activate: false,
                    expire: false
                },
                examplePlaceholder: '4/15/15 7:17 PM',
                toggle: function($event, picker){
                    $event.preventDefault();
                    $event.stopPropagation();
                    $scope.datetime.datepicker.datepickers[picker] = !$scope.datetime.datepicker.datepickers[picker];
                    $scope.datetime.timepicker.timepickers[picker] = !$scope.datetime.timepicker.timepickers[picker];
                }
            },
            timepicker: { // ui.bootstrap.timepicker
                timepickers: { // true == opened
                    start: false,
                    end: false,
                    activate: false,
                    expire: false
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
                    }
                    else{
                        $scope.datetime.timepicker.examplePlaceholder = '19:17';
                        $scope.datetime.datepicker.examplePlaceholder = '4/15/15 19:17';
                    }
                }
            },
            init: function(){
                $scope.datetime.now();
                $scope.datetime.browserTZ = $scope.datetime.getBrowserTimezone();
            },
            now: function() {
                // TODO - setup polling this function to refresh dt for status page
                // current datetime on init, used on status page
                $scope.dt = new Date();
            },
            getBrowserTimezone: function(){
                var tz = jstz.determine(); // Determines the time zone of the browser client
                return tz.name(); // Returns the name of the time zone eg "Europe/Berlin"
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
        $scope.saveRule = function(){
            // TODO - check if start time is before end time and if activate datetime is before expire datetime
            // either via on page validation or in this function before saving
            $http.post('/api/rules/save', {rule: $scope.newRule}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
        };
        $scope.removeRule = function(rule){
            $http.post('/api/rules/remove', {rule: rule}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
        };
        $scope.editRule = function(rule){
            // TODO - activate edit mode (whatever that is - likely either a modal or inline editing via fields turning into inputs)
            // TODO after editing save or cancel
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
        $scope.ruleTypeValue = function(ruleType){
            return $scope.newRule.rule[ruleType];
        };
        $scope.createRule = function(){
            // TODO ? - is all validation being handled on the page ? if not this needs validation
            $http.post('/api/rules/save', {newRule: $scope.newRule}).
                success(function( data ) {
                    $scope.newRuleInitialize();
                    $scope.rules = data.rules;
                });
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
            var modalInstance = $modal.open({
                templateUrl: 'createRuleOptionsModal',
                controller: 'ModalInstanceCtrl',
                size: size,
                resolve: {
                    datetime: function(){
                        return $scope.datetime;
                    }
                }
            });
            modalInstance.result.then(function (selectedItem) {
                $scope.selected = selectedItem;
            }, function () {
                $log.info('Modal dismissed at: ' + new Date());
            });
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
    controller('ModalInstanceCtrl', function ($scope, $modalInstance, datetime) {
        $scope.datetime = datetime;
        $scope.ok = function () {
            $modalInstance.close();
        };
        $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
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
        }
    });