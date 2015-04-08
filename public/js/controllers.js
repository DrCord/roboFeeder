'use strict';
/* Controllers */
angular.module('roboFeeder.controllers', []).
    controller('AppCtrl', function ($scope, $http, $resource, poller) {
        $scope.status = {};
        $scope.errors = [];
        $scope.newTag = '';
        $scope.log = [];
        $scope.removeTagSelect = {};
        $scope.roboFeederSettings = {};
        $scope.msgs = {
            alreadyAllowed: false
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
                if($scope.allowedTags.indexOf($scope.newTag) === -1){
                    $http.post('/api/tags/allowed/add', {tag: $scope.newTag}).
                        success(function( data ) {
                            $scope.allowedTags = data.allowedTags;
                            $scope.newTag = '';
                        });
                }
                else{
                    //show message stating tag is already allowed
                    $scope.msgs.alreadyAllowed = true;
                }
            }
        };
        $scope.removeTag = function(tag){
            $http.post('/api/tags/allowed/remove', {tag: tag}).
                success(function( data ) {
                    $scope.allowedTags = data.allowedTags;
            });
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
        $scope.init = function(){
            $scope.getStatuses();
            $scope.getAllowedTags();
            $scope.logPoller();
            $scope.statusPoller();
            $scope.getSettings();
        };
        // do stuff
        $scope.init();
    });
