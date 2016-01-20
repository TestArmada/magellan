"use strict";

var Q = require("q");

function BaseListener() {

}

BaseListener.prototype = {

  initialize: function () {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  },

  listenTo: function (/* testRun, test, source */) {

  },

  flush: function () {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  }

};

module.exports = BaseListener;
