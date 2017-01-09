"use strict";

const Q = require("q");

class BaseListener {
  initialize() {
    const deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  }

  listenTo(/* testRun, test, source */) {
  }

  flush() {
    const deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  }
}

module.exports = BaseListener;
