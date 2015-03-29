'use strict';

/* Directives */

angular.module('roboFeeder.directives', []).
  directive('appVersion', function (version) {
    return function(scope, elm, attrs) {
      elm.text(version);
    };
  });
