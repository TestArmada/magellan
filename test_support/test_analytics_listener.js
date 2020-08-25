var _ = require("lodash");
var Q = require("q");

var TestListener = function () {
  this.timeline = [];
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

  listenTo: function (testRun, test, source) {
    var self = this;
    source.addListener("message", function (message) {
      if (_.startsWith(message.type, "analytics-event")) {
        self.timeline.push(message);
      }
    });
  },

  flush: function () {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  }

};

module.exports = TestListener;