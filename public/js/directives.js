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
  directive('timeLowerThan', [
    function() {
        var link = function($scope, $element, $attrs, ctrl) {
            var validate = function(viewValue) {
                var comparisonModel = $attrs.timeLowerThan;

                if(!viewValue || !comparisonModel){
                    // It's valid because we have nothing to compare against
                    ctrl.$setValidity('timeLowerThan', true);
                }
                if(viewValue != null && typeof viewValue == "string"){
                    var time = viewValue.match(/(\d+)(?::(\d\d))?\s*(P?)/);
                    if(time != null){
                        var start = new Date();
                        start.setHours( parseInt(time[1]) + (time[3] ? 12 : 0) );
                        start.setMinutes( parseInt(time[2]) || 0 );
                    }
                }
                if(comparisonModel != null && typeof comparisonModel == "string"){
                    var time = comparisonModel.match(/(\d+)(?::(\d\d))?\s*(p?)/);
                    if(time != null){
                        var end = new Date();
                        end.setHours( parseInt(time[1]) + (time[3] ? 12 : 0) );
                        end.setMinutes( parseInt(time[2]) || 0 );
                    }
                }
                if((typeof start != "undefined") && (typeof end != "undefined")){
                    // It's valid if model is lower than the model we're comparing against
                    ctrl.$setValidity('timeLowerThan', parseInt(start.getTime(), 10) < parseInt(end.getTime(), 10) );
                }
                return viewValue;
            };

            ctrl.$parsers.unshift(validate);
            ctrl.$formatters.push(validate);

            $attrs.$observe('timeLowerThan', function(comparisonModel){
                // Whenever the comparison model changes we'll re-validate
                return validate(ctrl.$viewValue);
            });

        };

        return {
            require: 'ngModel',
            link: link
        };

    }
]).
  directive('datetimeBefore', [
    function() {
        var link = function($scope, $element, $attrs, ctrl) {
            var validate = function(viewValue) {
                var comparisonModel = $attrs.datetimeBefore;

                if(!viewValue || !comparisonModel){
                    // It's valid because we have nothing to compare against
                    ctrl.$setValidity('datetimeBefore', true);
                }
                if(viewValue != null && typeof viewValue == "string"){
                    var start = new Date(viewValue);
                    // http://stackoverflow.com/questions/1353684/detecting-an-invalid-date-date-instance-in-javascript
                    if ( Object.prototype.toString.call(start) === "[object Date]" ) {
                        // it is a date
                        if ( isNaN( start.getTime() ) ) {  // d.valueOf() could also work
                            // date is not valid
                            ctrl.$setValidity('startInvalidDate', false );
                        }
                        else {
                            // date is valid
                            ctrl.$setValidity('startInvalidDate', true );
                            var start_time = start.getTime();
                        }
                    }
                    else {
                        // not a date
                    }
                }
                if(comparisonModel != null && typeof comparisonModel == "string"){
                    var end = new Date(comparisonModel);
                    if ( Object.prototype.toString.call(end) === "[object Date]" ) {
                        // it is a date
                        if ( isNaN( end.getTime() ) ) {  // d.valueOf() could also work
                            // date is not valid
                            ctrl.$setValidity('endInvalidDate', false );
                        }
                        else {
                            // date is valid
                            ctrl.$setValidity('endInvalidDate', true );
                            var end_time = end.getTime();
                        }
                    }
                    else {
                        // not a date
                    }
                }
                if(
                    (typeof start_time != "undefined") && (typeof end_time != "undefined") && !isNaN(start_time) && !isNaN(end_time) ){
                    // It's valid if model is lower than the model we're comparing against
                    ctrl.$setValidity('datetimeBefore', parseInt(start_time, 10) < parseInt(start_time, 10) );
                }
                return viewValue;
            };

            ctrl.$parsers.unshift(validate);
            ctrl.$formatters.push(validate);

            $attrs.$observe('datetimeBefore', function(comparisonModel){
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
