var Q = require("q");

var BaseReporter = function () {
  
};

BaseReporter.prototype = {

  initialize: function () {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  },

  listenTo: function (testRun, source) {

  }

};

module.exports = BaseReporter;