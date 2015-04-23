'use strict';

/* Directives */

angular.module('roboFeeder.directives', []).
  directive('appVersion', function (version) {
    return function(scope, elm, attrs) {
      elm.text(version);
    };
  }).
  directive('myCurrentTime', function($timeout, dateFilter) {
        // return the directive link function. (compile function not needed)
        return function(scope, element, attrs) {
            var format,  // date format
                timeoutId; // timeoutId, so that we can cancel the time updates

            // used to update the UI
            function updateTime() {
                element.text(dateFilter(new Date(), format));
            }

            // watch the expression, and update the UI on change.
            scope.$watch(attrs.myCurrentTime, function(value) {
                format = value;
                updateTime();
            });

            // schedule update in one second
            function updateLater() {
                // save the timeoutId for canceling
                timeoutId = $timeout(function() {
                    updateTime(); // update DOM
                    updateLater(); // schedule another update
                }, 1000);
            }

            // listen on DOM destroy (removal) event, and cancel the next UI update
            // to prevent updating time ofter the DOM element was removed.
            element.bind('$destroy', function() {
                $timeout.cancel(timeoutId);
            });

            updateLater(); // kick off the UI update process.
        }
    }).
  directive('lowerThan', [
    function() {

        var link = function($scope, $element, $attrs, ctrl) {

            var validate = function(viewValue) {
                var comparisonModel = $attrs.lowerThan;

                if(!viewValue || !comparisonModel){
                    // It's valid because we have nothing to compare against
                    ctrl.$setValidity('lowerThan', true);
                }

                if(viewValue != null && typeof viewValue == "string"){
                    var d = new Date();
                    // TODO - fix regex to work with pm time!!!!
                    var time = viewValue.match(/(\d+)(?::(\d\d))?\s*(P?)/);
                    if(time != null){
                        d.setHours( parseInt(time[1]) + (time[3] ? 12 : 0) );
                        d.setMinutes( parseInt(time[2]) || 0 );
                        var start = d;

                        console.log('start');
                        console.log(start);
                        console.log('start.getHours()');
                        console.log(start.getHours());
                    }
                }

                if(comparisonModel != null && typeof comparisonModel == "string"){
                    var d = new Date();
                    var time = comparisonModel.match(/(\d+)(?::(\d\d))?\s*(p?)/);
                    if(time != null){
                        d.setHours( parseInt(time[1]) + (time[3] ? 12 : 0) );
                        d.setMinutes( parseInt(time[2]) || 0 );
                        var end = d;
                        console.log('end');
                        console.log(end);
                        console.log('end.getHours()');
                        console.log(end.getHours());
                    }
                }

                //start = new Date(start);
                //end = new Date(end);
                /*var start_hour = start.getHours();
                var end_hour = end.getHours();
                var start_min = start.getMinutes();
                var end_min = end.getMinutes();

                console.log('validateStartEndRange');
                console.log('start_hour');
                console.log(start_hour);
                console.log('end_hour');
                console.log(end_hour);
                console.log('start_hour < end_hour');
                console.log(start_hour < end_hour);*/

                console.log('directive - lowerThan');
                console.log('viewValue');
                console.log(viewValue);
                console.log('comparisonModel');
                console.log(comparisonModel);

                // It's valid if model is lower than the model we're comparing against
                ctrl.$setValidity('lowerThan', parseInt(start, 10) < parseInt(end, 10) );
                return viewValue;
            };

            ctrl.$parsers.unshift(validate);
            ctrl.$formatters.push(validate);

            $attrs.$observe('lowerThan', function(comparisonModel){
                // Whenever the comparison model changes we'll re-validate
                return validate(ctrl.$viewValue);
            });

        };

        return {
            require: 'ngModel',
            link: link
        };

    }
])
;
