'use strict';
/** Controllers */
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
angular.module('roboFeeder.controllers', ['ngAnimate']).
    controller('AppCtrl', function ($scope, $http, $resource, poller, $modal) {
        $scope.status = {};
        $scope.errors = {};
        $scope.newTag = '';
        $scope.newTagName = '';
        $scope.log = [];
        $scope.removeTagSelect = '';
        $scope.roboFeederSettings = {};
        $scope.allowedTags = [];
        $scope.rules = [];
        $scope.newRule = {};
        $scope.msgs = {
            alreadyAllowed: false,
            removeSelectTag: false,
            notValidCode: false,
            newRule: {
                sameName: false
            },
            editRule: {
                sameName: false
            }
        };
        $scope.ruleTableHeaders = [
            {
                title: 'Name',
                machine_name: 'name'
            },
            {
                title: 'Sort Order',
                machine_name: 'weight'
            },
            {
                title: 'Status',
                machine_name: 'active'
            },
            {
                title: 'Tag',
                machine_name: 'tag'
            },
            {
                title: 'Daily Start Time',
                machine_name: 'start'
            },
            {
                title: 'Daily End Time',
                machine_name: 'end'
            },
            {
                title: 'Activate datetime',
                machine_name: 'activate'
            },
            {
                title: 'Expire datetime',
                machine_name: 'expire'
            },
            {
                title: 'Actions',
                machine_name: 'actions'
            },
        ];
        $scope.tooltips = {
            rules: {
                name: 'Unique string to help the user identify a rule',
                weight: 'Sorts the rules on this page, larger values sink to the bottom',
                active: 'Enable/disable rule',
                tag: 'Select a tag from the allowed tags list. To add tags to the allowed list go to the "tags" page',
                start: 'Beginning time of daily allowed time period for this rule',
                end: 'Ending time of daily allowed time period for this rule',
                activate: 'Active period starting datetime, for example the first day of your vacation',
                expire: 'Expire datetime, for example the last day of your vacation',
                actions: 'Edit or delete a rule'
            }
        };
        $scope.datetime = {
            browserTZ: null,
            fields: [
                'start',
                'end',
                'activate',
                'expire'
            ],
            init: function(){
                $scope.datetime.browserTZ = $scope.datetime.getBrowserTimezone();
            },
            getBrowserTimezone: function(){
                var tz = jstz.determine(); // Determines the time zone of the browser client
                return tz.name(); // Returns the name of the time zone eg "Europe/Berlin"
            },
            convert: function(d){
                // Source: http://stackoverflow.com/questions/497790
                // Converts the date in d to a date-object. The input can be:
                //   a date object: returned without modification
                //  an array      : Interpreted as [year,month,day]. NOTE: month is 0-11.
                //   a number     : Interpreted as number of milliseconds
                //                  since 1 Jan 1970 (a timestamp)
                //   a string     : Any format supported by the javascript engine, like
                //                  "YYYY/MM/DD", "MM/DD/YYYY", "Jan 31 2009" etc.
                //  an object     : Interpreted as an object with year, month and date
                //                  attributes.  **NOTE** month is 0-11.
                return (
                    d.constructor === Date ? d :
                        d.constructor === Array ? new Date(d[0],d[1],d[2]) :
                            d.constructor === Number ? new Date(d) :
                                d.constructor === String ? new Date(d) :
                                    typeof d === "object" ? new Date(d.year,d.month,d.date) :
                                        NaN
                );
            },
            compare: function(a,b){
                // Source: http://stackoverflow.com/questions/497790
                // Compare two dates (could be of any type supported by the convert
                // function above) and returns:
                //  -1 : if a < b
                //   0 : if a = b
                //   1 : if a > b
                // NaN : if a or b is an illegal date
                // NOTE: The code inside isFinite does an assignment (=).
                return (
                    isFinite(a=this.convert(a).valueOf()) &&
                    isFinite(b=this.convert(b).valueOf()) ?
                    (a>b)-(a<b) :
                        NaN
                );
            }
        };
        $scope.tooltipHelper = function(type, name){
            return $scope.tooltips[type][name];
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
                var filterObj = $scope.filterAllowedTags($scope.newTag);
                if(typeof filterObj.tagObj == "undefined"){
                    var tagObj = {
                        tag: $scope.newTag,
                        name: $scope.newTagName
                    };
                    $http.post('/api/tags/allowed/add', {tagObj: tagObj}).
                        success(function( data ) {
                            $scope.allowedTags = data.allowedTags;
                            $scope.newTag = '';
                            $scope.newTagName = '';
                        });
                }
                else{
                    //show message
                    $scope.msgs.alreadyAllowed = true;
                }
            }
            else{
                //show message
                $scope.msgs.notValidCode = true;
            }
        };
        $scope.removeTag = function(tag){
            var filterObj = $scope.filterAllowedTags(tag);
            if(typeof filterObj.tagObj != "undefined"){
                $http.post('/api/tags/allowed/remove', {tag: tag}).
                    success(function( data ) {
                        $scope.allowedTags = data.allowedTags;
                        $scope.removeTagSelect = {};
                    });
            }
            else{
                //show message
                $scope.msgs.removeSelectTag = true;
            }
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
        $scope.getRules = function(){
            $http.get('/api/rules/get').success(function( data ) {
                $scope.rules = data.rules;
            });
        };
        $scope.saveEditedRule = function(ruleObj){
            delete ruleObj.editing;
            $http.post('/api/rules/edit', {ruleObj: ruleObj}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
        };
        $scope.removeRule = function(ruleObj){
            $http.post('/api/rules/remove', {rule: ruleObj}).
                success(function( data ) {
                    $scope.rules = data.rules;
                });
        };
        $scope.editRule = function(ruleObj){
            // use angular.copy to clone the ruleObj to prevent binding
            $scope.editedRule = angular.copy(ruleObj);
            $scope.editedRule.newName = ruleObj.name;
        };
        $scope.cancelEdit = function(){
            delete $scope.editedRule;
        };
        $scope.resetRules = function(){
            $http.get('/api/rules/reset').success(function( data ) {
                $scope.rules = data.rules;
            });
        };
        $scope.filterAllowedTags = function(tag){
            var tagIndex = null;
            var tagObj = $scope.allowedTags.filter(function ( obj, index ) {
                if(obj.tag === tag){
                    tagIndex = index;
                }
                return obj.tag === tag;
            })[0];
            return {tagIndex: tagIndex, tagObj: tagObj};
        };
        $scope.tagObjName = function(tagObj){
            if(typeof tagObj == "undefined"){
                return 'ALLOWED TAG NOT FOUND: INVALID RULE';
            }
            if(typeof tagObj.name == "undefined" || tagObj.name == ''){
                return tagObj.tag;
            }
            return tagObj.name + ' : ' + tagObj.tag;
        };
        $scope.tagDisplayName = function(tag){
            if(typeof tag != "undefined"){
                var filterObj = $scope.filterAllowedTags(tag);
                return $scope.tagObjName(filterObj.tagObj);
            }
        };
        $scope.ruleTypeValue = function(ruleObj, ruleType){
            return ruleObj.rule[ruleType];
        };
        $scope.createRule = function(){
            if($scope.validateRule($scope.newRule, 'new')){
                // page handles basic validation (is this filled in, correct data type)
                $http.post('/api/rules/save', {newRule: $scope.newRule}).
                    success(function( data ) {
                        $scope.newRuleInitialize();
                        $scope.rules = data.rules;
                        // reset form fully to allow $dirty and $pristine to work again
                        $scope.createRuleForm.$setPristine();
                    });
            }
        };
        $scope.validateRule = function(ruleObj, type){
            $scope.errors = {};
            // check if rule name is unique
            if(type == 'new' && ruleObj.name != ''){
                for(var i=0; i<$scope.rules.length;i++){
                    if ($scope.rules[i].name === ruleObj.name) {
                        $scope.errors['sameName'] = true;
                    }
                }
            }
            // error display messages
            var msgType = 'newRule';
            if(type == 'edit'){
                msgType = 'editRule';
            }
            $scope.msgs[msgType].emptyField = false;
            // no errors
            if($scope.errorsSize() === 0){
                return true;
            }
            else{
                // activate errors in DOM
                for(var i=0; i<Object.size($scope.errors); i++){
                    if(typeof $scope.errors['sameName'] != "undefined" && $scope.errors['sameName']){
                        $scope.msgs[msgType].sameName = true;
                    }
                }
            }
            return false;
        };
        $scope.newRuleInitialize = function(){
            $scope.newRule = {
                type: 'rule',
                name: '',
                weight: 0,
                active: true,
                browserTZ: $scope.datetime.browserTZ,
                rule: {
                    tag: '',
                    start: null,
                    end: null,
                    activate: null,
                    expire: null
                }
            };
        };
        $scope.createRuleEditModal = function(ruleObj, size) {
            $scope.editRule(ruleObj);
            $modal.open({
                templateUrl: 'createRuleEditModal',
                controller: 'ModalRuleEditCtrl',
                scope: $scope,
                size: size,
                resolve: {
                    ruleObj: function(){
                        return ruleObj;
                    }
                }
            });
        };
        $scope.ruleActiveString = function(status){
            return status ? 'Active' : 'Disabled';
        };
        $scope.errorsSize = function(){
            // returns boolean
            return Object.size($scope.errors);
        };
        $scope.sensorName = function(settingName){
            return settingName.replace(/Threshold/i, '').toUpperCase();
        };
        $scope.init = function(){
            $scope.getStatuses();
            $scope.getAllowedTags();
            $scope.logPoller();
            $scope.statusPoller();
            $scope.getSettings();
            $scope.datetime.init();
            $scope.newRuleInitialize();
            $scope.getRules();
        };
        // do stuff
        $scope.init();
    }).
    controller('ModalRuleEditCtrl', function ($scope, $modalInstance, ruleObj) {
        $scope.ruleObj = ruleObj;
        $scope.editedRule.newName = ruleObj.name;
        $scope.editedRule.rule.start = new Date($scope.ruleObj.rule.start);
        $scope.editedRule.rule.end = new Date($scope.ruleObj.rule.end);
        $scope.editedRule.rule.activate = new Date($scope.ruleObj.rule.activate);
        $scope.editedRule.rule.expire = new Date($scope.ruleObj.rule.expire);
        $scope.edited = false;
        $scope.saveRule = function () {
            if($scope.validateRule($scope.editedRule, 'edit')){
                $scope.ruleObj = $scope.editedRule;
                $scope.saveEditedRule($scope.ruleObj);
                $modalInstance.close();
            }
        };
        $scope.cancel = function () {
            $scope.cancelEdit();
            $modalInstance.dismiss('cancel');
        };
    });