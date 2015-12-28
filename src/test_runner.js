var exec = require("child_process").exec;
var fork = require("child_process").fork;
var async = require("async");
var _ = require("lodash");
var clc = require("cli-color");
var prettyMs = require("pretty-ms");
var path = require("path");
var Q = require("q");
var once = require("once");
var EventEmitter = require("events").EventEmitter;
var fs = require("fs");

var sauceBrowsers = require("./sauce/browsers");

var settings = require("./settings");
var Test = require("./test");

var WORKER_START_DELAY = 1000;
var WORKER_STOP_DELAY = 1500;
var WORKER_POLL_INTERVAL = 250;
var FINAL_REPORT_DELAY = 2500;

var strictness = {
  BAIL_NEVER: 1,     // never bail
  BAIL_TIME_ONLY: 2, // kill tests that run too slow early, but not the build
  BAIL_EARLY: 3,     // bail somewhat early, but within a threshold (see below), apply time rules
  BAIL_FAST: 4,      // bail as soon as a test fails, apply time rules

  // Ratio of tests that need to fail before we abandon the build in BAIL_EARLY mode
  THRESHOLD: 0.1,
  // Minimum number of tests that need to run before we test threshold rules
  THRESHOLD_MIN_ATTEMPTS: 10,

  // Running length after which we abandon and fail a test in any mode except BAIL_NEVER
  // Specified in milliseconds.
  LONG_RUNNING_TEST: settings.bailTime
};

/**
  A parallel test runner with retry logic and port allocation

  options:
    maxWorkers          - maximum number of workers for queue
    maxTestAttempts     - max number of test attempts
    getEnvironment      - function(worker, test) that returns a key value object to use as the process environment
    debug               - true/false flag for magellan debugging mode
    onSuccess           - function() callback
    onFailure           - function(failedTests) callback
*/
var TestRunner = function (tests, options) {
  var self = this;

  this.buildId = settings.buildId;

  this.strictness = options.bailFast
    ? strictness.BAIL_FAST
    :(options.bailOnThreshold
      ? strictness.BAIL_EARLY
      : ( settings.bailTimeExplicitlySet
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
  this.tests = _.flatten(tests.map(function (path) {
    return options.browsers.map(function (requestedBrowser) {
      // Note: For non-sauce browsers, this can come back empty, which is just fine.
      var sauceBrowserSettings = sauceBrowsers.browser(requestedBrowser.browserId, requestedBrowser.resolution, requestedBrowser.orientation);
      return new Test(path, requestedBrowser, sauceBrowserSettings, self.MAX_TEST_ATTEMPTS);
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

  // Set up a worker queue to process tests in parallel
  this.q = async.queue(this.stageTest.bind(this), this.MAX_WORKERS);

  // When the entire suite is run through the queue, run our drain handler
  this.q.drain = this.buildFinished.bind(this);
  
};

TestRunner.prototype = {

  start: function () {
    this.startTime = (new Date()).getTime();

    var browserStatement = " with ";
    browserStatement += this.browsers.map(function (b) { return b.toString(); }).join(", ");

    if (this.serial) {
      console.log("\nRunning " + this.numTests + " tests in serial mode" + browserStatement + "\n");
    } else {
      console.log("\nRunning " + this.numTests + " tests with " + this.MAX_WORKERS + " workers" + browserStatement + "\n");
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

  // Prepare a test to be run. Find a worker for the test and send it off to be run.
  stageTest: function (test, onTestComplete) {
    var self = this;
    this.allocator.get(function (error, worker) {
      if (!error) {
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
          .catch(function (error) {
            // Catch a testing infrastructure error unrelated to the test itself failing.
            // This indicates something went wrong with magellan itself. We still need
            // to drain the queue, so we fail the test, even though the test itself may
            // have not actually failed.
            console.log(clc.redBright("Fatal internal error while running a test:", error));
            console.log(clc.redBright(error.stack));

            // Give this worker back to the allocator
            self.allocator.release(worker);

            test.workerIndex = worker.index;
            test.error = error;
            test.stdout = "";
            test.stderr = error;

            test.fail();
            onTestComplete(error, test);
          });
      } else {
        // If the allocator could not give us a worker, pass
        // back a failed test result with the allocator's error.
        console.error("Worker allocator error: " + error);
        console.error(error.stack);

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
  spawnTestProcess: function (testRun) {
    var deferred = Q.defer();

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
      stdio:  ['pipe', 'pipe', 'pipe']
    };

    var childProcess;
    try {
      childProcess = fork(testRun.getCommand(), testRun.getArguments(), options);
    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    var startMessage;
    var workerCrashed = true;
    var crashEmitter = new EventEmitter();

    var stdout = "";
    var stderr = "";

    try {
      // Attach listeners that respond to messages sent from the running test.
      // These messages are sent with process.send()
      this.listeners.forEach(function (listener) {
        if (listener.listenTo) {
          listener.listenTo(testRun, childProcess);
          listener.listenTo(testRun, crashEmitter);
        }
      });
    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    // Note: There are three ways a process can die:
    //
    //   1. "close" emitted.
    //   2. "exit" emitted.
    //   3. direct call of workerClosed(), with a kill of the process tree.
    //
    // Because "close" emits unpredictably some time after we fulfill case
    // #3, we wrap this callback in once() so that we only clean up once.
    var workerClosed = once(function (code) {
      testRun.test.stopClock();
      clearInterval(sentry);

      // Detach ALL listeners that may have been attached 
      childProcess.stdout.removeAllListeners();
      childProcess.stderr.removeAllListeners();
      childProcess.stdout.unpipe();
      childProcess.stderr.unpipe();
      childProcess.removeAllListeners();

      if (workerCrashed) {
        // If we managed to get a start message from the test, then we can at least
        // deliver a correct-looking finish message to listeners.
        if (startMessage) {
          this.listeners.forEach(function (listener) {
            crashEmitter.emit("message", {
              type: "worker-status",
              name: startMessage.name,
              status: "finished"
            })
          });
        }
      }

      // Resolve the promise
      deferred.resolve({
        error: (code === 0) ? null : "Child test run process exited with code " + code,
        stderr: stderr,
        stdout: stdout
      });
    }).bind(this);

    if (this.debug) {
      // For debugging purposes.
      childProcess.on("message", function(msg) {
        console.log("Message from worker:", msg);
      });
    }

    // Exploit the reporting API to detect if a worker has crashed and manually
    // notify listeners of "finished" if the test started.
    //
    // 1) When a worker crashes, no "finished" status is sent from the worker and 
    //    we can conclude that the worker (test framework, or test) crashed before
    //    it was able to send out this message.
    //
    // 2) To avoid unexpected state transitions, we only send a "finished" event
    //    to a listener if we got a "started" event from a test, i.e. we don't
    //    finish tests that we never properly started in the first place.
    //
    childProcess.on("message", function (message) {
      if (message.type === "worker-status") {
        if (message.status === "finished") {
          workerCrashed = false;
        } else if (message.status === "started") {
          // Store the startmessage for this test, we'll need some of the details
          // to later send a "finished" if the test ends up crashing.
          startMessage = message;
        }
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
    testRun.test.startClock();
    var sentry = setInterval(function () {
      if (this.strictness === strictness.BAIL_NEVER) {
        return;
      }

      var runtime = testRun.test.getRuntime();

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
          customMessage: "Killed by magellan after " + strictness.LONG_RUNNING_TEST + "ms (long running test)"
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
      var TestRunClass = require("./interop/" + settings.framework + "/test_run");
      testRun = new TestRunClass({
        buildId: this.buildId,
        test: test,
        seleniumPort: worker.portOffset + 1,
        mockingPort: worker.portOffset,
        tunnelId: worker.tunnelId,
        sauceSettings: this.sauceSettings,
        sauceBrowserSettings: test.sauceBrowserSettings,
        debug: this.debug
      });
    } catch (e) {
      deferred.reject(e);
    }

    if (testRun) {
      setTimeout(function () {
        this.spawnTestProcess(testRun)
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
        existingTrends.failures[key] = existingTrends.failures[key] > -1 ? existingTrends.failures[key] + localFailureCount : localFailureCount;
      });

      fs.writeFileSync("./trends.json", JSON.stringify(existingTrends, null, 2));

      console.log("Updated trends at ./trends.json");
    }
  },

  logFailedTests: function () {
    console.log(clc.redBright("\n============= Failed Tests:  =============\n"));

    this.failedTests.forEach(function (failedTest) {
      console.log("\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ")
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
    setTimeout(function () {
      // We delay our report by a small yield time to allow bailed builds
      // to clean up before we start writing to the screen.
      this.summarizeCompletedBuild().then(function () {
        if (this.failedTests.length === 0) {
          this.onSuccess();
        } else {
          this.onFailure(this.failedTests);
        }
      }.bind(this));
    }.bind(this), FINAL_REPORT_DELAY);
  },

  // Completion callback called by async.queue when a test is completed
  onTestComplete: function (error, test) {
    if (this.hasBailed) {
      // Ignore results from this test if we've bailed. This is likely a test that 
      // was killed when the build went into bail mode.
      console.log("\u2716 " + clc.redBright("KILLED ") + " " + test.toString() + (this.serial ? "\n" : ""));
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
        this.trends.failures[key] = this.trends.failures[key] > -1 ? this.trends.failures[key] + 1 : 1;
      }

      if (this.failedTests.indexOf(test) === -1) {
        this.failedTests.push(test);
      }

      // Note: Tests that failed but can still run again are pushed back into the queue.
      // This push happens before the queue is given back flow control (at the end of 
      // this callback), which means that the queue isn't given the chance to drain.
      if (!test.canRun(true)) {
        this.q.push(test, this.onTestComplete.bind(this));
        testRequeued = true;
      }
    }

    var prefix;
    var suffix;

    if (this.serial) {
      prefix = "\n(" + (this.passedTests.length + this.failedTests.length) + " / " + this.numTests + ")";
      suffix = "\n";
    } else {
      prefix = "(" + (this.passedTests.length + this.failedTests.length) + " / " + this.numTests + ") <-- Worker " + test.workerIndex;
      suffix = "";
    }

    var requeueNote = testRequeued ? clc.cyanBright("(will retry)") : "";
    console.log(prefix + " " + (successful ? clc.greenBright("PASS ") : clc.redBright("FAIL ")) + requeueNote + " " + test.toString() + " " + suffix);

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
    if (this.strictness === strictness.BAIL_NEVER || strictness.BAIL_TIME_ONLY) {
      // BAIL_NEVER means we don't apply any strictness rules at all
      return false;
    } else if (this.strictness === strictness.BAIL_EARLY) {
      // --bail_early
      // Bail on a threshold. By default, if we've run at least 10 tests
      // and at least 10% of them (1) have failed, we bail out early. 
      // This allows for useful data-gathering for debugging or trend 
      // analysis if we don't want to just bail on the first failed test.

      var sumAttempts = function (memo, test) { return memo + test.attempts; };
      var totalAttempts = _.reduce(this.passedTests, sumAttempts, 0) + _.reduce(this.failedTests, sumAttempts, 0);

      // Failed attempts are not just the sum of all failed attempts but also 
      // of successful tests that eventually passed (i.e. total attempts - 1).
      var sumExtraAttempts = function (memo, test) { return memo + Math.max(test.attempts - 1, 0); };
      var failedAttempts = _.reduce(this.failedTests, sumAttempts, 0) + _.reduce(this.passedTests, sumExtraAttempts, 0);

      // Fail to total work ratio.
      var ratio = failedAttempts / totalAttempts;

      if (totalAttempts > strictness.THRESHOLD_MIN_ATTEMPTS) {
        if (ratio > strictness.THRESHOLD) {
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
