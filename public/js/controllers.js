'use strict';
/* Controllers */
angular.module('roboFeeder.controllers', []).
    controller('AppCtrl', function ($scope, $http) {
        $scope.status = {};
        $scope.errors = [];
        $scope.newTag = '';
        $scope.log = [];
        $scope.removeTagSelect = {};
        $scope.roboFeederSettings = {};
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
                $http.post('/api/tags/allowed/add', {tag: $scope.newTag}).
                    success(function( data ) {
                        $scope.allowedTags = data.allowedTags;
                        $scope.newTag = '';
                    });
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
        $scope.getLog = function(){
            $http.get('/api/log/get').success(function( data ) {
                $scope.log = data.log;
            });
        };
        $scope.resetLog = function(){
            $http.get('/api/log/reset').success(function( data ) {
                $scope.log = data.items || [];
            });
        };
        $scope.init = function(){
            $scope.getStatuses();
            $scope.getAllowedTags();
            $scope.getLog();
            $scope.getSettings();
        };
        // do stuff
        $scope.init();
    });
