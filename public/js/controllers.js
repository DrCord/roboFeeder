'use strict';

/* Controllers */

angular.module('roboFeeder.controllers', []).
  controller('AppCtrl', function ($scope, $http) {

    $http({
      method: 'GET',
      url: '/api/name'
    }).
    success(function (data, status, headers, config) {
      $scope.name = data.name;
    }).
    error(function (data, status, headers, config) {
      $scope.name = 'Error!';
    });

  }).
  controller('MyCtrl1', function ($scope) {
    $scope.allowedTags = [
        '03304786',
        '02150427'
    ];
  }).
  controller('MyCtrl2', function ($scope) {
    // write Ctrl here

  });
