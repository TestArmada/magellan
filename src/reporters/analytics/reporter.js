"use strict";

var Q = require("q");
var BaseReporter = require("../reporter");
var util = require("util");
var prettyMs = require("pretty-ms");
var _ = require("lodash");
var analytics = require("../../global_analytics");
var clc = require("cli-color");

var timeline = [];

var hasMarker = function (ev, markerName) {
  return ev.markers.find(function (marker) {
    return marker.name === markerName;
  });
};

var firstMarker = function (ev) {
  return ev.markers[0];
};

var lastMarker = function (ev) {
  return ev.markers[ev.markers.length - 1];
};

var diffMarkerTimes = function (startMarker, endMarker) {
  if (startMarker && endMarker) {
    return endMarker.t - startMarker.t;
  } else {
    return 0;
  }
};

var diffMarkers = function (ev, startName, endName, alternateEndName) {
  startName = startName ? startName : "start";
  endName = endName ? endName : "end";

  var startMarker = ev.markers.find(function (marker) {
    return marker.name === startName;
  });
  var endMarker = ev.markers.find(function (marker) {
    return (alternateEndName && marker.name === alternateEndName) || marker.name === endName;
  });
  return diffMarkerTimes(startMarker, endMarker);
};

function Reporter() {
}

util.inherits(Reporter, BaseReporter);

Reporter.prototype.initialize = function () {
  var self = this;
  var deferred = Q.defer();
  deferred.resolve();

  analytics.sync().forEach(function (message) {
    self._handleGlobalMessage(message);
  });

  // listen to global emitter
  analytics.getEmitter().addListener("message", this._handleGlobalMessage.bind(this));

  return deferred.promise;
};

// listen to a testRun's events on event emitter source.
Reporter.prototype.listenTo = function (testRun, test, source) {
  if (test && testRun) {
    // Every time a message is received regarding this test, we also get the test object
    // itself so that we're able to reason about retries, worker index, etc.
    source.addListener("message", this._handleTestRunMessage.bind(this, testRun, test));
  } else {
    source.addListener("message", this._handleGlobalMessage.bind(this));
  }
};

//
// Timeline marker: A timeline marker pertaining to a previously-received analytics event.
// Data structure for a timeline marker
// {
//   name: string marker name (eg: "failed", "passed", "end")
//   t: number timestamp
// }
//

// handle a message from a test
Reporter.prototype._handleTestRunMessage = function (testRun, test, message) {
  if (message && message.type && message.data) {
    if (message.type === "analytics-event") {
      timeline.push(message.data);
    } else if (message.type === "analytics-event-mark" && message.data) {
      // Find a previously-received event in our timeline and amend it with this marker.
      for (var i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].name === message.eventName) {
          timeline[i].markers.push(message.data);
          break;
        }
      }
    }
  }
};

// handle a message from a global source
Reporter.prototype._handleGlobalMessage = function (message) {
  if (message && message.type && message.data) {
    if (message.type === "analytics-event") {
      timeline.push(message.data);
    } else if (message.type === "analytics-event-mark" && message.data) {
      // Find a previously-received event in our timeline and amend it with this marker.
      for (var i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].name === message.eventName) {
          timeline[i].markers.push(message.data);
          break;
        }
      }
    }
  }
};

Reporter.prototype.flush = function () {
  var numFailedTests = 0;
  var numPassedTests = 0;
  var numRetries = 0;

  var magellanRun = _.find(timeline, function (item) {
    return item.name === "magellan-run";
  });
  var magellanTime = diffMarkers(magellanRun, "start", "passed", "failed");

  var testRuns = _.filter(timeline, function (item) {
    return _.startsWith(item.name, "test-run-");
  });

  var notTestRuns = _.filter(timeline, function (item) {
    return !_.startsWith(item.name, "test-run-");
  });

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
      return result;
    }
  }, 0);

  var timeSpentRetrying = _.reduce(testRuns, function (result, testRun) {
    var startMarker = testRun.markers.find(function (marker) {
      return marker.name === "start";
    });
    var endMarker = testRun.markers.find(function (marker) {
      return marker.name === "passed" || marker.name === "failed";
    });

    if (startMarker && endMarker && testRun.metadata.attemptNumber > 1) {
      numRetries++;
      return result + endMarker.t - startMarker.t;
    } else {
      return result;
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
      return result;
    }
  }, 0);

  var slowestFailingTest = _.chain(testRuns)
    .filter(function (testRun) {
      return hasMarker(testRun, "failed");
    })
    .maxBy(function (testRun) {
      return diffMarkers(testRun, "start", "failed");
    })
    .value();

  var slowestPassingTest = _.chain(testRuns)
    .filter(function (testRun) {
      return hasMarker(testRun, "passed");
    })
    .maxBy(testRuns, function (testRun) {
      return diffMarkers(testRun, "start", "passed");
    })
    .value();

  console.log(clc.greenBright("\n============= Runtime Stats ==============\n"));
  console.log("");
  console.log("                 # Test runs: " + testRuns.length);
  console.log("          # Passed test runs: " + numPassedTests);
  console.log("          # Failed test runs: " + numFailedTests);
  console.log("           # Re-attempt runs: " + numRetries);
  console.log("");
  console.log("                  Human time: " + prettyMs(timeSpentFailing + timeSpentPassing));
  console.log("               Magellan time: " + prettyMs(magellanTime));
  if (magellanTime > 0) {
    console.log("Human-to-Magellan multiplier: " + ((timeSpentFailing + timeSpentPassing) / magellanTime).toFixed(2) + "X");
  } else {
    console.log("Human-to-Magellan multiplier: N/A");
  }

  console.log("    Human time spent passing: " + prettyMs(timeSpentPassing));
  console.log("    Human time spent failing: " + prettyMs(timeSpentFailing));
  console.log("");

  if (numRetries > 0 && magellanTime > 0) {
    console.log("         Human time retrying: " + prettyMs(timeSpentRetrying));
    console.log("Retrying as % of total human: " + (timeSpentRetrying / (timeSpentFailing + timeSpentPassing)).toFixed(1) + "%");
  }


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

  if (slowestPassingTest) {
    console.log("");
    console.log("Slowest passing test:");
    console.log("      test: \"" + slowestPassingTest.metadata.test + "\" @: " + slowestPassingTest.metadata.browser + " ");
    console.log(" attempt #: " + slowestPassingTest.metadata.attemptNumber);
  }

  if (slowestFailingTest) {
    console.log("");
    console.log("      test: \"" + slowestFailingTest.metadata.test + "\" @: " + slowestFailingTest.metadata.browser + " ");
    console.log(" attempt #: " + slowestFailingTest.metadata.attemptNumber);
  }

  if (notTestRuns.length > 0 ) {
    var metrics = _.filter(notTestRuns, function (metric) {
      return metric.markers && metric.markers.length === 2;
    });

    if(metrics.length) {
      console.log("");
      console.log("Other timing metrics: ");
      metrics.forEach(function (metric) {
        var start = firstMarker(metric);
        var end = lastMarker(metric);
        var time = diffMarkerTimes(start, end);
        console.log("    " + metric.name + " (" + start.name + " -> " + end.name + ") " + prettyMs(time));
      });
      console.log("");
    }
  }

  console.log("");
};

module.exports = Reporter;
