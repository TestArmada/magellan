const _ = require("lodash");
const Q = require("q");

const TestListener = function () {
  this.timeline = [];
};

TestListener.prototype = {
  initialize () {
    const self = this;
    const deferred = Q.defer();
    setTimeout(() => {
      self.didInitialize = true;
      deferred.resolve();
    }, 1);
    return deferred.promise;
  },

  listenTo (testRun, test, source) {
    const self = this;
    source.addListener("message", (message) => {
      if (_.startsWith(message.type, "analytics-event")) {
        self.timeline.push(message);
      }
    });
  },

  flush () {
    const deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  }

};

module.exports = TestListener;
