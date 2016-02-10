"use strict";

var querystring = require("qs");
var _ = require("lodash");
var http = require("http");
var Q = require("q");
var settings = require("./settings");
var verbose = require("../../settings").debug;

var config = {};

var currentJobNum;

//
//
//
// NOTE: this variable doesn't appear to be used for anything meaningful
//
//
//
var currentResult = 0;

// Set global admiral config
var setConfig = function (_config) {
  /*
   * Configurable options (all required):
   *
   * authId
   * authToken
   * path
   * hostname
   * buildId
   * buildName
   */
  config = _.extend({}, config, _config);
};

// Throw an error and complain if we don't have all the required
// coniguration present needed to report to a admiral server.
var validateConfig = function () {
  if (verbose) {
    console.log("Validating admiral integration configuration");
  }
  var allConfigPresent = true;
  var configVars = [
    "authId",
    "authToken",
    "path",
    "hostname",
    "buildId",
    "buildName"
  ];

  configVars.forEach(function (k) {
    if (!config[k]) {
      console.error("Missing admiral configuration variable: ", k);
      allConfigPresent = false;
    } else if (verbose) {
      console.log(" ✓ " + k + " configuration variable found (value=" + config[k] + ")");
    }
  });

  if (!allConfigPresent) {
    throw new Error("Missing admiral environment variables.");
  }
};

var setJobNum = function (jobNum) {
  currentJobNum = jobNum;
};

var doAction = function (actionName, options, callback) {
  if (verbose) {
    console.info("========= Invoking Admiral Action: " + actionName + " =========");
    _.each(options, function (key, value) {
      console.info(" * " + value + ": " + key);
    });
  }

  var defaultOptions = {
    "authID": config.authId,
    "authToken": config.authToken
  };

  if (verbose) {
    console.log(" * authId: " + config.authId);
    console.log(" * authToken: " + config.authToken);
  }

  var data = querystring.stringify(_.extend(defaultOptions, options));

  var requestPath = config.path + "/api.php?action=" + actionName;
  try {
    if (verbose) {
      console.log("Updating admiral", requestPath);
    }
    var req = http.request({
      hostname: config.hostname,
      path: requestPath,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": data.length
      }
    }, function (res) {
      res.setEncoding("utf8");

      if (verbose) {
        console.log("Response: ", res.statusCode, JSON.stringify(res.headers));
      }

      var responseData = "";

      res.on("data", function (chunk) {
        responseData += chunk;
        if (verbose) {
          console.log("got: " + chunk);
        }
      });

      res.on("end", function () {
        var jsonData = {};

        if (verbose) {
          console.info("Admiral Response: " + responseData);
        }

        try {
          jsonData = JSON.parse(responseData);
        } catch (e) {
          console.error("Could not parse response as JSON: " + responseData);
        }

        return callback(jsonData);
      });
    });

    req.on("error", function (e) {
      console.log("problem with request: " + e.message);
    });
    req.write(data);
    req.end();
  } catch (err) {
    console.log("Error", err);
    return callback();
  }
};

var createJob = function () {
  var deferred = Q.defer();

  // config.buildId is the Jenkins Job number of the *parent* build that kicked off
  // all the browser-specific child builds.  We use this build ID to correlate all the
  // individual tests & browser results under one single report.
  var buildId = config.buildId;
  if (!buildId) {
    console.log("Missing configuration. Admiral settings object: ", settings);
    deferred.reject(new Error("Admiral config.buildId must be set to the current"
      + " Jenkins build number"));
    return deferred.promise;
  }

  // config.buildName is a text value that gives some descriptive meaning to this build.
  // For builds kicked off on a timer, this could be the timestamp of the build.  For builds
  // kicked off in response to a PR or a merge, this could be the PR description and
  // the developer's name.
  var buildName = config.buildName;
  if (!buildName) {
    console.log("Missing configuration. Admiral settings object: ", settings);
    deferred.reject(new Error("Admiral config.buildName must be set to the current"
      + " build name"));
    return deferred.promise;
  }

  var payload = {
    "buildId": buildId,
    "jobName": buildName
  };
  doAction("addjob", payload,
    function (response) {
      if (!response || !response.addjob || !response.addjob.id) {
        console.log("Debug information. Admiral settings object: ", settings);
        deferred.reject(new Error("Admiral error: Response did not include job ID. Error payload: "
          + JSON.stringify(response)));
        return;
      }

      // cache the job number for later use by other tasks
      currentJobNum = response.addjob.id;

      if (verbose) {
        console.info("Set current job number to: " + currentJobNum);
      }

      deferred.resolve(currentJobNum);
    }
  );

  return deferred.promise;
};


function Reporter() {

  console.log("Magellan Admiral Reporter initializing");
  console.log("Checking required configuration variables..");

  // Check configuration and throw an error if we don't have everything we need.
  validateConfig();

  var getCurrentJobNum = function () {
    if (!currentJobNum) {
      throw new Error("getCurrentJobNum(): currentJobNum not set -- make sure admiral job"
        + " initialization succeeded");
    }
    return currentJobNum;
  };

  var startTest = function (testName, browserId) {
    var deferred = Q.defer();

    if (!browserId) {
      throw new Error("browserId must be set when calling startTest()");
    }

    doAction("starttest", {
      "job_id": getCurrentJobNum(),
      "test_name": testName,
      //
      //
      // TODO: resolve apparent ambiguity when the same browserId is used
      //       multiple times in parallel but with different resolutions
      //       and/or orientations
      //       (module-wide)
      //
      //
      "ua_id": browserId
    }, function (result) {

      /*eslint-disable no-magic-numbers */
      if (!result) {
        deferred.reject(new Error("Result not sent"));
        return;
      } else if (result && result.error && result.error.info
          && result.error.info.indexOf("Duplicate") > -1) {
        deferred.reject(new Error("The Admiral server reported a duplicate job number entry."
          + " This can be fixed by changing the Magellan build number."));
        return;
      } else if (!result.starttest) {
        deferred.reject(new Error("Unexpected result: " + JSON.stringify(result)));
        return;
      }

      if (verbose) {
        console.log("Started test and got result ID: " + currentResult);
      }

      deferred.resolve();
    });

    return deferred.promise;
  };

  var finishTest = function (testName, browserId, total, fail, numRetries, resultUrl, callback) {

    doAction("finishtest", {
      "job_id": getCurrentJobNum(),
      "test_name": testName,
      "ua_id": browserId,
      "total": total,
      "fail": fail,
      "num_retries": numRetries,
      "result_url": resultUrl,
      "build_url": config.buildURL
    }, function () {
      currentResult = 0;
      callback();
    });
  };

  var markForRetry = function (testName, browserId, total, fail, resultUrl, callback) {

    doAction("pendingretry", {
      "job_id": getCurrentJobNum(),
      "test_name": testName,
      "ua_id": browserId,
      "total": total,
      "fail": fail,
      "result_url": resultUrl,
      "build_url": config.buildURL
    }, function () {
      currentResult = 0;
      callback();
    });
  };

  // Defined here for the moment so that we have all the above functions in scope
  // and don't need to touch any of the previously-working admiral code.

  this._handleMessage = function (test, message) {
    if (this.ignoreMessages) {
      return;
    }

    //
    // admiral's test lifecycle model:
    //
    // 1) Start
    //    A test is being run for the very first time in a given browser, with attempts at 0
    //
    // 2) Mark for retry (with a result, eg: sauceURL)
    //    We are retrying a test, with attempts not yet at the maximum number
    //    of allowable attempts.
    //
    // 3) Finish (with a result, eg: sauceURL + pass/fail)
    //    We have either run a test with a passing result or we've exhausted
    //    the maximum number of allowable attempts
    //
    if (message.type === "worker-status") {
      if (message.status === "started") {
        //
        // We only call startTest for admiral purposes if this test is
        // coming to life for the first time. We ignore start messages
        // thereafter because those are emited by retries.
        //
        if (test.attempts === 0) {
          startTest(message.name, test.browser.browserId)
            .then(function () {

            })
            .catch(function (e) {
              console.error("Error starting Admiral test:");
              console.error(e);
              // We don't have access to listeners here, so instead we self-disable
              console.log("Owlswarm reporter is self-disabling and ignoring further messages");
              this.ignoreMessages = true;
            }.bind(this));
        }
      } else if (message.status === "finished") {
        var pass = message.passed;
        var resultURL = message.metadata ? message.metadata.resultURL : "";

        if (pass) {
          // We've finished a test and it passed
          finishTest(message.name, test.browser.browserId, 1, 0, test.attempts, resultURL,
            function () {});
        } else if (test.attempts === test.maxAttempts - 1) {
          // Is this our last attempt ever? Then mark the test as finished and failed.
          finishTest(message.name, test.browser.browserId, 1, 1, test.attempts, resultURL,
            function () {});
        } else {
          // We've failed a test and we're going to retry it
          markForRetry(message.name, test.browser.browserId, 1, 1, resultURL, function () {});
        }
      }
    }
  };
}

Reporter.prototype = {
  initialize: function () {
    this.ignoreMessages = false;

    var deferred = Q.defer();
    if (settings.enabled) {
      console.log("Admiral is enabled; Requesting job number...");
      createJob().then(function (jobNum) {
        console.log("Admiral Job Number: " + jobNum);
        setJobNum(jobNum);
        deferred.resolve();
      }).catch(function (error) {
        console.log("Could not obtain Admiral job number due to an error.");
        deferred.reject(error);
      });
    } else {
      deferred.resolve();
    }
    return deferred.promise;
  },

  listenTo: function (testRun, test, source) {
    // Every time a message is received regarding this test, we also get the test object
    // itself so that we're able to reason about retries, worker index, etc.
    source.addListener("message", this._handleMessage.bind(this, test));
  },

  flush: function () {
    console.log("\n");
    console.log("============================ Report ============================");
    console.log("Visual report matrix available at: ");
    console.log("http://" + settings.hostname + settings.path + "/job/" + currentJobNum);
    console.log("================================================================");
    console.log("\n");
  }
};

module.exports = {
  reporter: Reporter,
  setConfig: setConfig
};
