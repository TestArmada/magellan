"use strict";

var Q = require("q");
var BaseReporter = require("../reporter");
var util = require("util");
var prettyMs = require("pretty-ms");
var _ = require("lodash");

var timeline = [];

var diffMarkers = function (ev, startName, endName, alternateEndName) {
  startName = startName ? startName : "start";
  endName = endName ? endName : "end";

  var startMarker = ev.markers.find(function (marker) {
    return marker.name === startName;
  });
  var endMarker = ev.markers.find(function (marker) {
    return (alternateEndName && marker.name === alternateEndName) || marker.name === endName;
  });

  if (startMarker && endMarker) {
    return endMarker.t - startMarker.t;
  } else {
    return 0;
  }
};

function Reporter() {
}

util.inherits(Reporter, BaseReporter);

Reporter.prototype.initialize = function () {
  var deferred = Q.defer();

  //
  //
  //
  // TODO: sync up with buffer from global analytics and amend to local timeline
  //
  //
  //

  deferred.resolve();
  return deferred.promise;
};

Reporter.prototype.listenTo = function (testRun, test, source) {
  if (test && testRun) {
    // Every time a message is received regarding this test, we also get the test object
    // itself so that we're able to reason about retries, worker index, etc.
    source.addListener("message", this._handleTestRunMessage.bind(this, testRun, test));
  } else {
    source.addListener("message", this._handleGlobalMessage.bind(this));
  }
};

Reporter.prototype._handleTestRunMessage = function (testRun, test, message) {
  console.log("_handleTestRunMessage analytics reporter received: ", message);

  // handle a message from a test
  if (message && message.type && message.data) {
    if (message.type === "analytics-event") {
      timeline.push(message.data);
    } else if (message.type === "analytics-event-mark" && message.data) {
      //
      // This is a timeline marker pertaining to a previously-received analytics event.
      // Find that previously-received event in our timeline and amend it with this marker.
      //
      for (var i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].name === message.eventName) {
          //
          // Data structure for a timeline "mark":
          // {
          //   name: string marker name (eg: "failed", "passed", "end")
          //   t: number timestamp
          // }
          //
          timeline[i].markers.push(message.data);
          break;
        }
      }
    }
  }
};

Reporter.prototype._handleGlobalMessage = function (message) {
  // handle a message from a global source
};

Reporter.prototype.flush = function () {
  var numFailedTests = 0;
  var numPassedTests = 0;

  // var magellanRun = _.find(timeline, function (item) {
  //   return item.name === "magellan-run";
  // });

  // var magellanTime = diffMarkers(magellanRun, "start", "passed", "failed");

  var testRuns = _.filter(timeline, function (item) {
    return _.startsWith(item.name, "test-run-");
  });

  var notTestRuns = _.filter(timeline, function (item) {
    return !_.startsWith(item.name, "test-run-");
  });

  console.log(JSON.stringify(notTestRuns, null, 2));

  var timeSpentPassing = _.reduce(testRuns, function (result, testRun) {
    var startMarker = testRun.markers.find(function (marker) {
      return marker.name === "start";
    });
    var endMarker = testRun.markers.find(function (marker) {
      return marker.name === "passed";
    });

    if (startMarker && endMarker) {
      numPassedTests++;
      return result + endMarker.t - startMarker.t;
    } else {
      return result + 0;
    }
  }, 0);

  var timeSpentFailing = _.reduce(testRuns, function (result, testRun) {
    var startMarker = testRun.markers.find(function (marker) {
      return marker.name === "start";
    });
    var endMarker = testRun.markers.find(function (marker) {
      return marker.name === "failed";
    });

    if (startMarker && endMarker) {
      numFailedTests++;
      return result + endMarker.t - startMarker.t;
    } else {
      return result + 0;
    }
  }, 0);

  var slowestFailingTest = _.maxBy(testRuns, function (testRun) {
    return diffMarkers(testRun, "start", "failed");
  });

  var slowestPassingTest = _.maxBy(testRuns, function (testRun) {
    return diffMarkers(testRun, "start", "passed");
  });

  console.log(JSON.stringify(timeline,null,2));

  console.log("Runtime Stats");
  console.log("");
  console.log("                 # Test runs: " + testRuns.length);
  console.log("          # Passed test runs: " + numPassedTests);
  console.log("          # Failed test runs: " + numFailedTests);
  console.log("                  Human time: " + prettyMs(timeSpentFailing + timeSpentPassing));
  // console.log("               Magellan time: " + prettyMs(magellanTime));
  // console.log("Human-to-Magellan multiplier: " + ((timeSpentFailing + timeSpentPassing) / magellanTime).toFixed(2) + "X");
  console.log("    Human time spent passing: " + prettyMs(timeSpentPassing));
  console.log("    Human time spent failing: " + prettyMs(timeSpentFailing));
  if (testRuns.length > 0) {
    console.log("       Average test run time: " + prettyMs((timeSpentFailing + timeSpentPassing) / testRuns.length));
  } else {
    console.log("       Average test run time: N/A");
  }

  if (numFailedTests > 0) {
    console.log("Average failed test run time: " + prettyMs(timeSpentFailing / numFailedTests));
  } else {
    console.log("Average failed test run time: N/A");
  }

  if (numPassedTests > 0) {
    console.log("Average passed test run time: " + prettyMs(timeSpentPassing / numPassedTests));
  } else {
    console.log("Average passed test run time: N/A");
  }
  console.log("Slowest passing test", slowestPassingTest);
  console.log("Slowest failing test", slowestFailingTest);
};

Reporter.prototype._handleMessage = function (testRun, test, message) {
};

module.exports = Reporter;
