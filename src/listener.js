var Q = require("q");

var BaseListener = function () {
  
};

BaseListener.prototype = {

  initialize: function () {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  },

  listenTo: function (testRun, source) {

  },

  flush: function () {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  }

};

module.exports = BaseListener;