'use strict';

// Declare app level module which depends on filters, and services

angular.module('roboFeeder', [
  'ngRoute',
  'ngResource',
  'emguo.poller',
  'roboFeeder.controllers',
  'roboFeeder.filters',
  'roboFeeder.services',
  'roboFeeder.directives'
]).
config(function ($routeProvider, $locationProvider) {
  $routeProvider.
    when('/status', {
      templateUrl: 'partials/status',
      controller: 'AppCtrl'
    }).
    when('/tags', {
      templateUrl: 'partials/tags',
      controller: 'AppCtrl'
    }).
    when('/settings', {
      templateUrl: 'partials/settings',
      controller: 'AppCtrl'
    }).
    when('/log', {
      templateUrl: 'partials/log',
      controller: 'AppCtrl'
    }).
    otherwise({
      redirectTo: '/status'
    });

  $locationProvider.html5Mode(true);
});
