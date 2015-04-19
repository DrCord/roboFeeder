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
  }).
  filter('toArray', function(){
        return function(obj) {
            var result = [];
            angular.forEach(obj, function(val, key) {
                result.push(val);
            });
            return result;
        };
    }).filter('capitalize', function() { // from http://codepen.io/WinterJoey/pen/sfFaK
    return function(input, all) {
        return (!!input) ? input.replace(/([^\W_]+[^\s-]*) */g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();}) : '';
    }
  })
;