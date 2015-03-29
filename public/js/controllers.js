'use strict';
/* Controllers */
angular.module('roboFeeder.controllers', []).
    controller('AppCtrl', function ($scope, $http) {
        $scope.status = {};
        $scope.errors = [];
        // get allowed tags
        $http.get('/api/allowedTags/get').success(function( data ) {
            $scope.allowedTags = data.allowedTags;
        });
        // get statuses
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
        $scope.init = function(){
            $scope.getStatuses();
        };
        $scope.init();
    });
