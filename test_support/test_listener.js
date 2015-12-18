var Q = require("q");

var TestListener = function () {
  this.testMessages = [];  
};

TestListener.prototype = {

  initialize: function () {
    var self = this
    var deferred = Q.defer();
    setTimeout(function () {
      self.didInitialize = true;
      deferred.resolve();
    }, 1);
    return deferred.promise;
  },

  listenTo: function (testRun, source) {
    var self = this;
    source.addListener("message", function (message) {
      self.testMessages.push(message);
    });
  },

  flush: function () {
    var self = this;
    var deferred = Q.defer();
    setTimeout(function () {
      self.didFlush = true;
      deferred.resolve();
    }, 1);
    return deferred.promise;
  }

};

module.exports = TestListener;