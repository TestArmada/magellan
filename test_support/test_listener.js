const Q = require("q");

const TestListener = function () {
  this.testMessages = [];
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
      self.testMessages.push(message);
    });
  },

  flush () {
    const self = this;
    const deferred = Q.defer();
    setTimeout(() => {
      self.didFlush = true;
      deferred.resolve();
    }, 1);
    return deferred.promise;
  }

};

module.exports = TestListener;
