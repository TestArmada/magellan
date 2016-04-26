"use strict";

var fork = require("child_process").fork;
var processCleanup = require("./util/process_cleanup");
var async = require("async");
var _ = require("lodash");
var clc = require("cli-color");
var prettyMs = require("pretty-ms");
var path = require("path");
var Q = require("q");
var once = require("once");
var EventEmitter = require("events").EventEmitter;
var fs = require("fs");
var mkdirSync = require("./mkdir_sync");
var guid = require("./util/guid");
var sanitizeFilename = require("sanitize-filename");

var sauceBrowsers = require("./sauce/browsers");
var analytics = require("./global_analytics");

var settings = require("./settings");
var Test = require("./test");

var WORKER_START_DELAY = 1000;
var WORKER_STOP_DELAY = 1500;
var WORKER_POLL_INTERVAL = 250;
var FINAL_CLEANUP_DELAY = 2500;

var strictness = {
  BAIL_NEVER: 1,     // never bail
  BAIL_TIME_ONLY: 2, // kill tests that run too slow early, but not the build
  BAIL_EARLY: 3,     // bail somewhat early, but within a threshold (see below), apply time rules
  BAIL_FAST: 4,      // bail as soon as a test fails, apply time rules

  // Ratio of tests that need to fail before we abandon the build in BAIL_EARLY mode
  THRESHOLD: settings.bailThreshold,
  // Minimum number of tests that need to run before we test threshold rules
  THRESHOLD_MIN_ATTEMPTS: settings.bailMinAttempts,

  // Running length after which we abandon and fail a test in any mode except BAIL_NEVER
  // Specified in milliseconds.
  LONG_RUNNING_TEST: settings.bailTime
};

//
// A parallel test runner with retry logic and port allocation
//
// options:
//   maxWorkers          - maximum number of workers for queue
//   maxTestAttempts     - max number of test attempts
//   getEnvironment      - function(worker, test) that returns a key value object to use as the
//                         process environment
//   debug               - true/false flag for magellan debugging mode
//   onSuccess           - function() callback
//   onFailure           - function(failedTests) callback
//
function TestRunner(tests, options) {
  var self = this;

  // Allow for bail time to be set "late" (eg: unit tests)
  strictness.LONG_RUNNING_TEST = settings.bailTime;

  this.buildId = settings.buildId;

  this.busyCount = 0;

  // FIXME: remove these eslint disables when this is simplified and has a test
  /*eslint-disable no-nested-ternary*/
  /*eslint-disable no-extra-parens*/
  this.strictness = options.bailFast
    ? strictness.BAIL_FAST
    : (options.bailOnThreshold
      ? strictness.BAIL_EARLY
      : (settings.bailTimeExplicitlySet
        ? strictness.BAIL_TIME_ONLY
        : strictness.BAIL_NEVER
      )
    );

  this.MAX_WORKERS = options.maxWorkers;

  // Attempt tests once only if we're in fast bail mode
  this.MAX_TEST_ATTEMPTS = this.strictness === strictness.BAIL_FAST
    ? 1
    : options.maxTestAttempts;

  this.hasBailed = false;

  this.browsers = options.browsers;
  this.debug = options.debug;

  this.serial = options.serial || false;

  this.sauceSettings = options.sauceSettings;

  this.listeners = options.listeners || [];

  this.onFailure = options.onFailure;
  this.onSuccess = options.onSuccess;

  this.allocator = options.allocator;

  // For each actual test path, split out
  this.tests = _.flatten(tests.map(function (testLocator) {
    return options.browsers.map(function (requestedBrowser) {
      // Note: For non-sauce browsers, this can come back empty, which is just fine.
      var sauceBrowserSettings = sauceBrowsers.browser(requestedBrowser.browserId,
        requestedBrowser.resolution, requestedBrowser.orientation);
      return new Test(testLocator, requestedBrowser, sauceBrowserSettings, self.MAX_TEST_ATTEMPTS);
    });
  }));

  if (settings.gatherTrends) {
    this.trends = {
      failures: {}
    };
    console.log("Gathering trends to ./trends.json");
  }

  this.numTests = this.tests.length;
  this.passedTests = [];
  this.failedTests = [];

  // Holds the number of tests that reached max retries
  this.numTestsMaxRetries = 0;

  // Set up a worker queue to process tests in parallel
  this.q = async.queue(this.stageTest.bind(this), this.MAX_WORKERS);

  // When the entire suite is run through the queue, run our drain handler
  this.q.drain = this.buildFinished.bind(this);

}

TestRunner.prototype = {

  start: function () {
    this.startTime = (new Date()).getTime();

    var browserStatement = " with ";
    browserStatement += this.browsers.map(function (b) { return b.toString(); }).join(", ");

    if (this.serial) {
      console.log("\nRunning " + this.numTests + " tests in serial mode" + browserStatement + "\n");
    } else {
      console.log("\nRunning " + this.numTests + " tests with " + this.MAX_WORKERS
        + " workers" + browserStatement + "\n");
    }

    if (this.tests.length === 0) {
      this.q.drain();
    } else {
      // Queue up tests; this will cause them to actually start
      // running immediately.
      this.tests.forEach(function (test) {
        this.q.push(test, this.onTestComplete.bind(this));
      }.bind(this));
    }
  },

  notIdle: function () {
    this.busyCount++;

    if (this.busyCount === 1) {
      // we transitioned from being idle to being busy
      analytics.mark("magellan-busy", "busy");
    }
  },

  maybeIdle: function () {
    this.busyCount--;

    if (this.busyCount === 0) {
      // we transitioned from being busy into being idle
      analytics.mark("magellan-busy", "idle");
    }
  },

  // Prepare a test to be run. Find a worker for the test and send it off to be run.
  stageTest: function (test, onTestComplete) {
    var self = this;
    var analyticsGuid = guid();

    analytics.push("acquire-worker-" + analyticsGuid);

    this.allocator.get(function (error, worker) {
      if (!error) {
        analytics.mark("acquire-worker-" + analyticsGuid);

        this.runTest(test, worker)
          .then(function (runResults) {
            // Give this worker back to the allocator
            self.allocator.release(worker);

            test.workerIndex = worker.index;
            test.error = runResults.error;
            test.stdout = runResults.stdout;
            test.stderr = runResults.stderr;

            // Pass or fail the test
            if (runResults.error) {
              test.fail();
            } else {
              test.pass();
            }

            onTestComplete(null, test);
          })
          .catch(function (runTestError) {
            // Catch a testing infrastructure error unrelated to the test itself failing.
            // This indicates something went wrong with magellan itself. We still need
            // to drain the queue, so we fail the test, even though the test itself may
            // have not actually failed.
            console.log(clc.redBright("Fatal internal error while running a test:", runTestError));
            console.log(clc.redBright(runTestError.stack));

            // Give this worker back to the allocator
            self.allocator.release(worker);

            test.workerIndex = worker.index;
            test.error = runTestError;
            test.stdout = "";
            test.stderr = runTestError;

            test.fail();
            onTestComplete(runTestError, test);
          });
      } else {
        analytics.mark("acquire-worker-" + analyticsGuid, "failed");
        // If the allocator could not give us a worker, pass
        // back a failed test result with the allocator's error.
        console.error("Worker allocator error: " + error);
        console.error(error.stack);

        /*eslint-disable no-magic-numbers*/
        test.workerIndex = -1;
        test.error = undefined;
        test.stdout = "";
        test.stderr = error;

        test.fail();

        onTestComplete(null, test);
      }
    }.bind(this));
  },

  // Spawn a process for a given test run
  // Return a promise that resolves with test results after test has been run.
  // Rejections only happen if we encounter a problem with magellan itself, not
  // the test. The test will resolve with a test result whether it fails or passes.
  spawnTestProcess: function (testRun, test) {
    var deferred = Q.defer();
    var self = this;

    var env;
    try {
      env = testRun.getEnvironment(settings.environment);
    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    var options = {
      env: env,
      silent: true,
      detached: false,
      stdio: ["pipe", "pipe", "pipe"]
    };

    var childProcess;
    try {
      childProcess = fork(testRun.getCommand(), testRun.getArguments(), options);
      this.notIdle();
    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    // Simulate some of the aspects of a node process by adding stdout and stderr streams
    // that can be used by listeners and reporters.
    var statusEmitter = new EventEmitter();
    statusEmitter.stdout = childProcess.stdout;
    statusEmitter.stderr = childProcess.stderr;

    var sentry;

    var seleniumSessionId;
    var stdout = "";
    var stderr = "";

    try {
      // Attach listeners that respond to messages sent from the running test.
      // These messages are sent with process.send()
      this.listeners.forEach(function (listener) {
        if (listener.listenTo) {
          listener.listenTo(testRun, test, statusEmitter);
        }
      });

      statusEmitter.emit("message", {
        type: "worker-status",
        status: "started",
        name: test.locator.toString()
      });

    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    statusEmitter.emit("message", {
      type: "analytics-event",
      data: {
        name: "test-run-" + testRun.guid,

        markers: [{
          name: "start",
          t: Date.now()
        }],

        metadata: {
          test: test.locator.toString(),
          browser: test.browser.browserId,
          // NOTE: attempt numbers are 1-indexed
          attemptNumber: (test.attempts + 1)
        }
      }
    });

    // Note: There are three ways a process can die:
    //
    //   1. "close" emitted.
    //   2. "exit" emitted.
    //   3. direct call of workerClosed(), with a kill of the process tree.
    //
    // Because "close" emits unpredictably some time after we fulfill case
    // #3, we wrap this callback in once() so that we only clean up once.
    var workerClosed = once(function (code) {
      self.maybeIdle();

      statusEmitter.emit("message", {
        type: "analytics-event-mark",
        eventName: "test-run-" + testRun.guid,
        data: {
          name: code === 0 ? "passed" : "failed",
          t: Date.now()
        }
      });

      test.stopClock();
      clearInterval(sentry);

      statusEmitter.emit("message", {
        type: "worker-status",
        status: "finished",
        name: test.locator.toString(),
        passed: code === 0,
        metadata: {
          //
          // TODO: move the generation of this resultURL to sauce support modules
          // TODO: leave it open to have result URLs for anything including non-sauce tests
          //       right now this is directly tied to sauce since sauce is the only thing that
          //       generates a resultURL, but in the future, we may have resultURLs that
          //       originate from somewhere else.
          //
          resultURL: "https://saucelabs.com/tests/" + seleniumSessionId
        }
      });

      // Detach ALL listeners that may have been attached
      childProcess.stdout.removeAllListeners();
      childProcess.stderr.removeAllListeners();
      childProcess.stdout.unpipe();
      childProcess.stderr.unpipe();
      childProcess.removeAllListeners();

      statusEmitter.stdout = null;
      statusEmitter.stderr = null;

      // Resolve the promise
      deferred.resolve({
        error: (code === 0) ? null : "Child test run process exited with code " + code,
        stderr: stderr,
        stdout: stdout
      });
    }).bind(this);

    if (this.debug) {
      // For debugging purposes.
      childProcess.on("message", function (msg) {
        console.log("Message from worker:", msg);
      });
    }

    //
    // Via IPC, capture the current selenium session id.
    // Reporters and listeners can exploit this to tie certain runtime artifacts to the unique
    // identity of the test run.
    //
    // FIXME: make it possible to receive this information from test frameworks not based on nodejs
    //
    childProcess.on("message", function (message) {
      if (message.type === "selenium-session-info") {
        seleniumSessionId = message.sessionId;
      }
    });

    childProcess.stdout.on("data", function (data) {
      stdout += ("" + data);
    });

    childProcess.stderr.on("data", function (data) {
      stderr += ("" + data);
    });

    childProcess.on("close", workerClosed);

    // A sentry monitors how long a given worker has been working. In every
    // strictness level except BAIL_NEVER, we kill a worker process and its
    // process tree if its been running for too long.
    test.startClock();
    sentry = setInterval(function () {
      if (this.strictness === strictness.BAIL_NEVER) {
        return;
      }

      var runtime = test.getRuntime();

      // Kill a running test under one of two conditions:
      //   1. We've been asked to bail with this.hasBailed
      //   2. the runtime for this test exceeds the limit.
      //
      if (this.hasBailed || runtime > strictness.LONG_RUNNING_TEST) {
        // Stop the sentry now because we are going to yield for a moment before
        // calling workerClosed(), which is normally responsible for stopping
        // the sentry from monitoring.
        clearInterval(sentry);

        // Tell the child to shut down the running test immediately
        childProcess.send({
          signal: "bail",
          customMessage: "Killed by magellan after " + strictness.LONG_RUNNING_TEST
            + "ms (long running test)"
        });

        setTimeout(function () {
          // We pass code 1 to simulate a failure return code from fork()
          workerClosed(1);
        }, WORKER_STOP_DELAY);
      }
    }.bind(this), WORKER_POLL_INTERVAL);

    return deferred.promise;
  },

  // Run a test with a given worker.
  // with a modified version of the test that contains its run status
  runTest: function (test, worker) {
    var deferred = Q.defer();

    // do not report test starts if we've bailed.
    if (!this.hasBailed) {
      var msg = [];

      msg.push("-->");
      msg.push((this.serial ? "Serial mode" : "Worker " + worker.index) + ",");

      if (this.sauceSettings && worker.tunnelId) {
        msg.push("tunnel id: " + worker.tunnelId + ",");
      }

      msg.push("mock port:" + worker.portOffset + ",");

      if (worker.token) {
        msg.push("VM token:" + worker.token + ",");
      }

      msg.push("running test: " + test.toString());

      console.log(msg.join(" "));
    }

    var testRun;

    try {
      var TestRunClass = settings.testFramework.TestRun;
      var childBuildId = guid();

      // Note: we must sanitize the buildid because it might contain slashes or "..", etc
      var tempAssetPath = path.resolve(settings.tempDir + "/build-"
        + sanitizeFilename(this.buildId) + "_" + childBuildId + "__temp_assets");

      mkdirSync(tempAssetPath);

      testRun = new TestRunClass({
        guid: childBuildId,

        // The id of this build, used by some reporters to identify the overall suite run. This
        // can also be used by test run implementations to identify an individual suite run as
        // part of some larger suite run.
        // NOTE: This must appear as an externally accessible property on the TestRun instance
        buildId: this.buildId,

        // Temporary asset path that Magellan guarantees exists and only belongs to this
        // individual test run. Temporary files, logs, screenshots, etc can be put here.
        // NOTE: This must appear as an externally accessible property on the TestRun instance
        tempAssetPath: tempAssetPath,

        // Magellan environment id (i.e. id of browser, id of device, version, etc.),
        // typically reflects one of the items from --browsers=item1,item2,item3 options
        environmentId: test.browser.browserId,

        // The locator object originally generated by the plugin itself
        locator: test.locator,

        seleniumPort: worker.portOffset + 1,
        mockingPort: worker.portOffset,

        tunnelId: worker.tunnelId,
        sauceSettings: this.sauceSettings,
        sauceBrowserSettings: test.sauceBrowserSettings
      });
    } catch (e) {
      deferred.reject(e);
    }

    if (testRun) {
      setTimeout(function () {
        this.spawnTestProcess(testRun, test)
          .then(deferred.resolve)
          .catch(deferred.reject);
      }.bind(this), WORKER_START_DELAY);
    }

    return deferred.promise;
  },

  gatherTrends: function () {
    if (settings.gatherTrends) {
      console.log("Updating trends ...");

      var existingTrends;
      var self = this;

      try {
        existingTrends = JSON.parse(fs.readFileSync("./trends.json"));
      } catch (e) {
        existingTrends = {failures: {}};
      }

      Object.keys(this.trends.failures).forEach(function (key) {
        var localFailureCount = self.trends.failures[key];
        /*eslint-disable no-magic-numbers*/
        existingTrends.failures[key] = existingTrends.failures[key] > -1
          ? existingTrends.failures[key] + localFailureCount : localFailureCount;
      });

      fs.writeFileSync("./trends.json", JSON.stringify(existingTrends, null, 2));

      console.log("Updated trends at ./trends.json");
    }
  },

  logFailedTests: function () {
    console.log(clc.redBright("\n============= Failed Tests:  =============\n"));

    this.failedTests.forEach(function (failedTest) {
      console.log("\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -"
        + " - - - - - - - - - - - - - - - ");
      console.log("Failed Test: " + failedTest.toString());
      console.log(" # attempts: " + failedTest.attempts);
      console.log("     output: ");
      console.log(failedTest.stdout);
      console.log(failedTest.stderr);
    });
  },

  // Print information about a completed build to the screen, showing failures and
  // bringing in any information from listeners
  summarizeCompletedBuild: function () {
    var deferred = Q.defer();

    this.gatherTrends();

    if (this.failedTests.length > 0) {
      this.logFailedTests();
    }

    var status;

    if (this.hasBailed) {
      status = clc.redBright("BAILED EARLY (due to failures)");
    } else {
      status = (this.failedTests.length > 0 ? clc.redBright("FAILED") : clc.greenBright("PASSED"));
    }

    if (this.failedTests.length > 0) {
      analytics.mark("magellan-run", "failed");
    } else {
      analytics.mark("magellan-run", "passed");
    }

    console.log(clc.greenBright("\n============= Suite Complete =============\n"));
    console.log("     Status: " + status);
    console.log("    Runtime: " + prettyMs((new Date()).getTime() - this.startTime));
    console.log("Total tests: " + this.numTests);
    console.log(" Successful: " + this.passedTests.length + " / " + this.numTests);

    if (this.failedTests.length > 0) {
      console.log("     Failed: " + this.failedTests.length + " / " + this.numTests);
    }

    var skipped = this.numTests - (this.passedTests.length + this.failedTests.length);
    if (this.hasBailed && skipped > 0) {
      console.log("    Skipped: " + skipped);
    }

    var flushNextListener = function () {
      if (this.listeners.length === 0) {
        // There are no listeners left to flush. We've summarized all build reports.
        deferred.resolve();
      } else {
        // flush listeners in the same order we added them to the listeners list
        var listener = this.listeners.shift();
        if (typeof listener.flush === "function") {
          // This listener implements flush. Run it and check if the result is a promise
          // in case we need to wait on the listener to finish a long-running task first.
          var promise = listener.flush();
          if (promise && typeof promise.then === "function") {
            // This is a listener that returns a promise. Wait and then flush.
            promise
              .then(flushNextListener)
              .catch(function (error) {
                console.log("Error when flushing listener output: ", error);
                flushNextListener();
              });
          } else {
            // This listener that does not return a promise. Keep flushing!
            flushNextListener();
          }
        } else {
          // This listener doesn't implement flush(). Keep flushing!
          flushNextListener();
        }
      }
    }.bind(this);

    flushNextListener();

    return deferred.promise;
  },

  // Handle an empty work queue:
  // Display a build summary and then either signal success or failure.
  buildFinished: function () {
    var self = this;

    setTimeout(function () {
      // We delay our report to allow bailed builds to clean up before we
      // outputting our final report to the screen. If processes hang around
      // for too long, processCleanup() will get rid of them for us.
      processCleanup(function () {
        self.summarizeCompletedBuild().then(function () {
          if (self.failedTests.length === 0) {
            self.onSuccess();
          } else {
            self.onFailure(self.failedTests);
          }
        });
      });
    }, FINAL_CLEANUP_DELAY, true);
  },

  // Completion callback called by async.queue when a test is completed
  onTestComplete: function (error, test) {
    if (this.hasBailed) {
      // Ignore results from this test if we've bailed. This is likely a test that
      // was killed when the build went into bail mode.
      console.log("\u2716 " + clc.redBright("KILLED ") + " " + test.toString()
        + (this.serial ? "\n" : ""));
      return;
    }

    var successful = test.status === Test.TEST_STATUS_SUCCESSFUL;
    var testRequeued = false;

    if (successful) {
      // Add this test to the passed test list, then remove it from the failed test
      // list (just in case it's a test we just retried after a previous failure).
      this.passedTests.push(test);
      this.failedTests = _.difference(this.failedTests, this.passedTests);
    } else {

      if (settings.gatherTrends) {
        var key = test.toString();
        /*eslint-disable no-magic-numbers*/
        this.trends.failures[key] = this.trends.failures[key] > -1
          ? this.trends.failures[key] + 1 : 1;
      }

      /*eslint-disable no-magic-numbers*/
      if (this.failedTests.indexOf(test) === -1) {
        this.failedTests.push(test);
      }

      // Note: Tests that failed but can still run again are pushed back into the queue.
      // This push happens before the queue is given back flow control (at the end of
      // this callback), which means that the queue isn't given the chance to drain.
      if (!test.canRun(true)) {
        this.q.push(test, this.onTestComplete.bind(this));
        testRequeued = true;
      } else {
        if (test.reachedMaxAttempts()) {
          this.numTestsMaxRetries++;
        }
      }
    }

    var prefix;
    var suffix;

    if (this.serial) {
      prefix = "\n(" + (this.passedTests.length + this.numTestsMaxRetries.length) + " / "
        + this.numTests + ")";
      suffix = "\n";
    } else if (testRequeued) {
      prefix = "(retry " + test.attempts + " / "
        + this.maxAttempts + ") <-- Worker " + test.workerIndex;
      suffix = "";
    } else {
      prefix = "(" + (this.passedTests.length + this.numTestsMaxRetries.length) + " / "
        + this.numTests + ") <-- Worker " + test.workerIndex;
      suffix = "";
    }

    var requeueNote = testRequeued ? clc.cyanBright("(will retry)") : "";
    console.log(prefix + " "
      + (successful ? clc.greenBright("PASS ") : clc.redBright("FAIL ")) + requeueNote + " "
      + test.toString() + " " + suffix);

    this.checkBuild();
  },

  // Check to see how the build is going and optionally fail the build early.
  checkBuild: function () {
    if (!this.hasBailed && this.shouldBail()) {
      // Kill the rest of the queue, preventing any new tests from running and shutting
      // down buildFinished
      this.q.kill();

      // Set a bail flag. Effects:
      //   1. Ignore results from any remaining tests that are still running.
      //   2. Signal to any running sentries that we should kill any running tests.
      this.hasBailed = true;

      this.buildFinished();
    }
  },

  // Return true if this build should stop running and fail immediately.
  shouldBail: function () {
    if (this.strictness === strictness.BAIL_NEVER
      || this.strictness === strictness.BAIL_TIME_ONLY) {
      // BAIL_NEVER means we don't apply any strictness rules at all
      return false;
    } else if (this.strictness === strictness.BAIL_EARLY) {
      // --bail_early
      // Bail on a threshold. By default, if we've run at least 10 tests
      // and at least 10% of them (1) have failed, we bail out early.
      // This allows for useful data-gathering for debugging or trend
      // analysis if we don't want to just bail on the first failed test.

      var sumAttempts = function (memo, test) { return memo + test.attempts; };
      var totalAttempts = _.reduce(this.passedTests, sumAttempts, 0)
        + _.reduce(this.failedTests, sumAttempts, 0);

      // Failed attempts are not just the sum of all failed attempts but also
      // of successful tests that eventually passed (i.e. total attempts - 1).
      var sumExtraAttempts = function (memo, test) {
        return memo + Math.max(test.attempts - 1, 0);
      };
      var failedAttempts = _.reduce(this.failedTests, sumAttempts, 0)
        + _.reduce(this.passedTests, sumExtraAttempts, 0);

      // Fail to total work ratio.
      var ratio = failedAttempts / totalAttempts;

      if (totalAttempts > strictness.THRESHOLD_MIN_ATTEMPTS) {
        if (ratio > strictness.THRESHOLD) {
          console.log("Magellan has seen at least " + (strictness.THRESHOLD * 100) + "% of "
            + " tests fail after seeing at least " + strictness.THRESHOLD_MIN_ATTEMPTS
            + " tests run. Bailing early.");
          return true;
        }
      }
    } else if (this.strictness === strictness.BAIL_FAST) {
      // --bail_fast
      // Bail as soon as a test has failed.
      return this.failedTests.length > 0;
    }
  }
};

module.exports = TestRunner;
