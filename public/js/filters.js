'use strict';

/* Filters */

angular.module('roboFeeder.filters', []).
  filter('interpolate', function (version) {
    return function (text) {
      return String(text).replace(/\%VERSION\%/mg, version);
    };
  }).
  filter('reverse', function() {
        return function(items) {
            return items.slice().reverse();
        };
  }).filter('toArray', function(){
        return function(obj) {
            var result = [];
            angular.forEach(obj, function(val, key) {
                result.push(val);
            });
            return result;
        };
    })
;