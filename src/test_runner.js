/* eslint complexity: 0, no-invalid-this: 0, prefer-const: 0 */
"use strict";

// TODO: Extract trending into another class
// TODO: Move bailFast to a strategy pattern implementation

const async = require("async");
const _ = require("lodash");
const clc = require("cli-color");
const prettyMs = require("pretty-ms");
const path = require("path");
const Q = require("q");
const once = require("once");
const EventEmitter = require("events").EventEmitter;
const fs = require("fs");
const mkdirSync = require("./mkdir_sync");
const guid = require("./util/guid");
const logStamp = require("./util/logstamp");
const sanitizeFilename = require("sanitize-filename");
const analytics = require("./global_analytics");

const settings = require("./settings");
const Test = require("./test");
const logger = require("testarmada-logger");
logger.prefix = "Magellan";

const WORKER_START_DELAY = 1000;
const WORKER_STOP_DELAY = 1500;
const WORKER_POLL_INTERVAL = 250;
const FINAL_CLEANUP_DELAY = 2500;

const strictness = {
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
// opts: testing options
class TestRunner {
  constructor(tests, options, opts) {
    _.assign(this, {
      fs,
      mkdirSync,
      settings,
      setTimeout,
      clearInterval,
      setInterval,
      prettyMs,
      path,
      analytics
    }, opts);

    // Allow for bail time to be set "late" (eg: unit tests)
    strictness.LONG_RUNNING_TEST = this.settings.bailTime;

    this.buildId = this.settings.buildId;

    this.busyCount = 0;

    this.retryCount = 0;

    // FIXME: remove these eslint disables when this is simplified and has a test
    /*eslint-disable no-nested-ternary*/
    /*eslint-disable no-extra-parens*/
    this.strictness = options.bailFast
      ? strictness.BAIL_FAST
      : (options.bailOnThreshold
        ? strictness.BAIL_EARLY
        : (this.settings.bailTimeExplicitlySet
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

    this.profiles = options.profiles;
    this.executors = options.executors;
    this.debug = options.debug;

    this.serial = options.serial || false;

    this.listeners = options.listeners || [];

    this.onFailure = options.onFailure;
    this.onSuccess = options.onSuccess;

    this.allocator = options.allocator;

    // For each actual test path, split out
    this.tests = _.flatten(tests.map((testLocator) => {
      return options.profiles.map((profile) => {
        return new Test(testLocator, profile,
          this.executors[profile.executor], this.MAX_TEST_ATTEMPTS);
      });
    }));

    if (this.settings.gatherTrends) {
      this.trends = {
        failures: {}
      };
      logger.log("Gathering trends to ./trends.json");
    }

    this.numTests = this.tests.length;
    this.passedTests = [];
    this.failedTests = [];

    // Set up a worker queue to process tests in parallel
    this.q = async.queue(this.stageTest.bind(this), this.MAX_WORKERS);

    // When the entire suite is run through the queue, run our drain handler
    this.q.drain = this.buildFinished.bind(this);
  }

  start() {
    this.startTime = (new Date()).getTime();

    let profileStatement = this.profiles.map((b) => b.toString()).join(", ");

    if (this.serial) {
      logger.log("Running " + this.numTests + " tests in serial mode with ["
        + profileStatement + "]");
    } else {
      logger.log("Running " + this.numTests + " tests with " + this.MAX_WORKERS
        + " workers with [" + profileStatement + "]");
    }

    if (this.tests.length === 0) {
      this.q.drain();
    } else {
      // Queue up tests; this will cause them to actually start
      // running immediately.
      this.tests.forEach((test) => {
        this.q.push(test, this.onTestComplete.bind(this));
      });
    }
  }

  notIdle() {
    this.busyCount++;

    if (this.busyCount === 1) {
      // we transitioned from being idle to being busy
      this.analytics.mark("magellan-busy", "busy");
    }
  }

  maybeIdle() {
    this.busyCount--;

    if (this.busyCount === 0) {
      // we transitioned from being busy into being idle
      this.analytics.mark("magellan-busy", "idle");
    }
  }

  // Prepare a test to be run. Find a worker for the test and send it off to be run.
  stageTest(test, onTestComplete) {
    const analyticsGuid = guid();

    this.analytics.push("acquire-worker-" + analyticsGuid);

    const failTest = (error) => {
      this.analytics.mark("acquire-worker-" + analyticsGuid, "failed");
      // If the allocator could not give us a worker, pass
      // back a failed test result with the allocator's error.
      logger.err("Worker allocator error: " + error);
      logger.err(error.stack);

      /*eslint-disable no-magic-numbers*/
      test.workerIndex = -1;
      test.error = undefined;
      test.stdout = "";
      test.stderr = error;

      test.fail();

      onTestComplete(null, test);
    };

    test.executor.setupTest((stageExecutorError, token) => {
      if (!stageExecutorError) {

        this.allocator.get((getWorkerError, worker) => {
          if (!getWorkerError) {

            this.analytics.mark("acquire-worker-" + analyticsGuid);

            this.runTest(test, worker)
              .then((runResults) => {
                // Give this worker back to the allocator
                /*eslint-disable max-nested-callbacks*/
                test.executor.teardownTest(token, () => {
                  this.allocator.release(worker);
                });

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
              .catch((runTestError) => {
                // Catch a testing infrastructure error unrelated to the test itself failing.
                // This indicates something went wrong with magellan itself. We still need
                // to drain the queue, so we fail the test, even though the test itself may
                // have not actually failed.
                logger.err("Fatal internal error while running a test:" + runTestError);
                logger.err(runTestError.stack);

                // Give this worker back to the allocator
                /*eslint-disable max-nested-callbacks*/
                test.executor.wrapup(() => {
                  this.allocator.release(worker);
                });

                test.workerIndex = worker.index;
                test.error = runTestError;
                test.stdout = "";
                test.stderr = runTestError;

                test.fail();
                onTestComplete(runTestError, test);
              });
          } else {
            // fail test due to failure of allocator.get()
            failTest(getWorkerError);
          }
        });
      } else {
        // fail test due to failure of test.executor.stage()
        failTest(stageExecutorError);
      }
    });
  }

  // Spawn a process for a given test run
  // Return a promise that resolves with test results after test has been run.
  // Rejections only happen if we encounter a problem with magellan itself, not
  // Rejections only happen if we encounter a problem with magellan itself, not
  // the test. The test will resolve with a test result whether it fails or passes.
  execute(testRun, test) {
    const deferred = Q.defer();

    if (testRun.enableExecutor
      && typeof testRun.enableExecutor === "function") {
      // if we have addExecutor defined in test run (new in magellan 10.0.0)
      testRun.enableExecutor(test.executor);
    }

    let env;
    try {
      env = testRun.getEnvironment(this.settings.environment);
    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    const options = {
      env,
      silent: true,
      detached: false,
      stdio: ["pipe", "pipe", "pipe", "ipc"]
    };

    let handler;
    try {
      //////////////////////////////////////////////////
      handler = this.executors[test.profile.executor].execute(testRun, options);
      this.notIdle();
    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    // Simulate some of the aspects of a node process by adding stdout and stderr streams
    // that can be used by listeners and reporters.
    const statusEmitter = new EventEmitter();
    statusEmitter.stdout = handler.stdout;
    statusEmitter.stderr = handler.stderr;
    const statusEmitterEmit = (type, message) => {
      statusEmitter.emit(type, message);
    };

    let sentry;

    let testMetadata;
    let stdout = clc.greenBright(logStamp()) + " Magellan child process start\n\n";
    let stderr = "";

    try {
      // Attach listeners that respond to messages sent from the running test.
      // These messages are sent with process.send()
      this.listeners.forEach((listener) => {
        if (listener.listenTo) {
          listener.listenTo(testRun, test, statusEmitter);
        }
      });

      statusEmitterEmit("message", {
        type: "worker-status",
        status: "started",
        name: test.locator.toString()
      });

    } catch (e) {
      deferred.reject(e);
      return deferred.promise;
    }

    statusEmitterEmit("message", {
      type: "analytics-event",
      data: {
        name: "test-run-" + testRun.guid,

        markers: [{
          name: "start",
          t: Date.now()
        }],

        metadata: {
          test: test.locator.toString(),
          profile: test.profile.id,
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
    const workerClosed = once((code) => {
      this.maybeIdle();

      statusEmitterEmit("message", {
        type: "analytics-event-mark",
        eventName: "test-run-" + testRun.guid,
        data: {
          name: code === 0 ? "passed" : "failed",
          t: Date.now()
        }
      });

      test.stopClock();
      this.clearInterval(sentry);

      // add executor info into meta-data
      if (testMetadata) {
        testMetadata.executor = test.executor.shortName;
      }

      statusEmitterEmit("message", {
        type: "worker-status",
        status: "finished",
        name: test.locator.toString(),
        passed: code === 0,
        metadata: testMetadata
      });

      // Detach ALL listeners that may have been attached
      handler.stdout.removeAllListeners();
      handler.stderr.removeAllListeners();
      handler.stdout.unpipe();
      handler.stderr.unpipe();
      handler.removeAllListeners();

      statusEmitter.stdout = null;
      statusEmitter.stderr = null;

      test.executor.summerizeTest(
        this.buildId,
        {
          result: code === 0,
          metadata: testMetadata
        },
        () => {
          // Resolve the promise
          deferred.resolve({
            error: (code === 0) ? null : "Child test run process exited with code " + code,
            stderr,
            stdout
          });
        });
    });

    if (this.debug) {
      // For debugging purposes.
      handler.on("message", (msg) => {
        logger.debug("Message from worker:" + JSON.stringify(msg));
      });
    }

    //
    // Via IPC, capture the current selenium session id.
    // Reporters and listeners can exploit this to tie certain runtime artifacts to the unique
    // identity of the test run.
    //
    // FIXME: make it possible to receive this information from test frameworks not based on nodejs
    //
    handler.on("message", (message) => {
      if (message.type === "test-meta-data") {
        testMetadata = message.metadata;
      }
    });

    handler.stdout.on("data", (data) => {
      let text = ("" + data);
      if (text.trim() !== "") {
        text = text
          .split("\n")
          .filter((line) => {
            /* istanbul ignore next */
            return line.trim() !== "" || line.indexOf("\n") > -1;
          })
          .map((line) => {
            // NOTE: since this comes from stdout, color the stamps green
            return clc.greenBright(logStamp()) + " " + line;
          })
          .join("\n");

        /* istanbul ignore else */
        if (text.length > 0) {
          stdout += text + "\n";
        } else {
          stdout += "\n";
        }
      }
    });

    handler.stderr.on("data", (data) => {
      let text = ("" + data);
      if (text.trim() !== "") {
        text = text
          .split("\n")
          .filter((line) => {
            /* istanbul ignore next */
            return line.trim() !== "" || line.indexOf("\n") > -1;
          })
          .map((line) => {
            // NOTE: since this comes from stderr, color the stamps red
            return clc.redBright(logStamp()) + " " + line;
          })
          .join("\n");
        /* istanbul ignore else */
        if (text.length > 0) {
          stdout += text + "\n";
        } else {
          stdout += "\n";
        }
      }
    });

    handler.on("close", workerClosed);

    // A sentry monitors how long a given worker has been working. In every
    // strictness level except BAIL_NEVER, we kill a worker process and its
    // process tree if its been running for too long.
    test.startClock();
    sentry = this.setInterval(() => {
      if (this.strictness === strictness.BAIL_NEVER) {
        return;
      }

      const runtime = test.getRuntime();

      // Kill a running test under one of two conditions:
      //   1. We've been asked to bail with this.hasBailed
      //   2. the runtime for this test exceeds the limit.
      //
      if (this.hasBailed || runtime > strictness.LONG_RUNNING_TEST) {
        // Stop the sentry now because we are going to yield for a moment before
        // calling workerClosed(), which is normally responsible for stopping
        // the sentry from monitoring.
        this.clearInterval(sentry);

        // Tell the child to shut down the running test immediately
        handler.send({
          signal: "bail",
          customMessage: "Killed by magellan after " + strictness.LONG_RUNNING_TEST
          + "ms (long running test)"
        });

        this.setTimeout(() => {
          // We pass code 1 to simulate a failure return code from fork()
          workerClosed(1);
        }, WORKER_STOP_DELAY);
      }
    }, WORKER_POLL_INTERVAL);

    return deferred.promise;
  }

  // Run a test with a given worker.
  // with a modified version of the test that contains its run status
  runTest(test, worker) {
    const deferred = Q.defer();

    // do not report test starts if we've bailed.
    if (!this.hasBailed) {
      const msg = [];

      msg.push("-->");
      msg.push((this.serial ? "Serial mode" : "Worker " + worker.index) + ",");

      msg.push("port range: [" + worker.portOffset + ", "
        + worker.portOffset + settings.BASE_PORT_SPACING - 1 + "],");

      if (worker.token) {
        msg.push("VM token:" + worker.token + ",");
      }

      msg.push("running test: " + test.toString());

      logger.log(msg.join(" "));
    }

    let testRun;

    try {
      const TestRunClass = this.settings.testFramework.TestRun;
      const childBuildId = guid();

      // Note: we must sanitize the buildid because it might contain slashes or "..", etc
      const tempAssetPath = this.path.resolve(this.settings.tempDir + "/build-"
        + sanitizeFilename(this.buildId) + "_" + childBuildId + "__temp_assets");

      this.mkdirSync(tempAssetPath);

      // magellan default port rule
      let ports = {
        seleniumPort: worker.portOffset,
        mockingPort: null
      };

      if (settings.BASE_PORT_SPACING === 1) {
        logger.warn("Only one port is available per worker, "
          + "increase --base_port_spacing to allocate more ports per worker");
      } else {
        ports.mockingPort = worker.portOffset + 1;
      }

      // if executor has its own port rule
      if (test.executor.getPorts
        && typeof test.executor.getPorts === "function") {
        ports = test.executor.getPorts({
          portOffset: worker.portOffset,
          portIndent: settings.BASE_PORT_SPACING
        });
      }

      testRun = new TestRunClass(_.assign({
        guid: childBuildId,

        // The id of this build, used by some reporters to identify the overall suite run. This
        // can also be used by test run implementations to identify an individual suite run as
        // part of some larger suite run.
        // NOTE: This must appear as an externally accessible property on the TestRun instance
        buildId: this.buildId,

        // Temporary asset path that Magellan guarantees exists and only belongs to this
        // individual test run. Temporary files, logs, screenshots, etc can be put here.
        // NOTE: This must appear as an externally accessible property on the TestRun instance
        tempAssetPath,

        // Magellan environment id (i.e. id of browser, id of device, version, etc.),
        // typically reflects one of the items from --browsers=item1,item2,item3 options
        // environmentId: test.browser.browserId,
        profile: test.profile,
        // executor: this.executors[test.profile.executor],

        // The locator object originally generated by the plugin itself
        locator: test.locator
      }, ports));
    } catch (e) {
      deferred.reject(e);
    }

    if (testRun) {
      this.setTimeout(() => {
        this.execute(testRun, test)
          .then(deferred.resolve)
          .catch(deferred.reject);
      }, WORKER_START_DELAY);
    }

    return deferred.promise;
  }

  gatherTrends() {
    if (this.settings.gatherTrends) {
      logger.log("Updating trends ...");

      let existingTrends;

      try {
        existingTrends = JSON.parse(this.fs.readFileSync("./trends.json"));
      } catch (e) {
        existingTrends = { failures: {} };
      }

      Object.keys(this.trends.failures).forEach((key) => {
        const localFailureCount = this.trends.failures[key];
        /*eslint-disable no-magic-numbers*/
        existingTrends.failures[key] = existingTrends.failures[key] > -1
          ? existingTrends.failures[key] + localFailureCount : localFailureCount;
      });

      this.fs.writeFileSync("./trends.json", JSON.stringify(existingTrends, null, 2));

      logger.log("Updated trends at ./trends.json");
    }
  }

  logFailedTests() {
    logger.log(clc.redBright("============= Failed Tests:  ============="));

    this.failedTests.forEach((failedTest) => {
      logger.log("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -");
      logger.log("Failed Test: " + failedTest.toString());
      logger.log(" # attempts: " + failedTest.attempts);
      logger.log("     output: ");
      logger.log(failedTest.stdout);
      logger.log(failedTest.stderr);
    });
  }

  // Print information about a completed build to the screen, showing failures and
  // bringing in any information from listeners
  summarizeCompletedBuild() {
    const deferred = Q.defer();

    const retryMetrics = {};

    this.gatherTrends();

    if (this.failedTests.length > 0) {
      this.logFailedTests();
    }

    let status;

    if (this.hasBailed) {
      status = clc.redBright("BAILED EARLY (due to failures)");
    } else {
      status = (this.failedTests.length > 0 ? clc.redBright("FAILED") : clc.greenBright("PASSED"));
    }

    if (this.failedTests.length > 0) {
      this.analytics.mark("magellan-run", "failed");
    } else {
      this.analytics.mark("magellan-run", "passed");
    }

    this.tests.forEach((test) => {
      if (test.status === 3 && test.getRetries() > 0) {
        if (retryMetrics[test.getRetries()]) {
          retryMetrics[test.getRetries()]++;
        } else {
          retryMetrics[test.getRetries()] = 1;
        }
      }
    });

    logger.log(clc.greenBright("============= Suite Complete ============="));
    logger.log("     Status: " + status);
    logger.log("    Runtime: " + this.prettyMs((new Date()).getTime() - this.startTime));
    logger.log("Total tests: " + this.numTests);
    logger.log(" Successful: " + this.passedTests.length + " / " + this.numTests);

    _.forOwn(retryMetrics, (testCount, numRetries) => {
      logger.log(testCount + " test(s) have retried: " + numRetries + " time(s)");
    });

    if (this.failedTests.length > 0) {
      logger.log("     Failed: " + this.failedTests.length + " / " + this.numTests);
    }

    const skipped = this.numTests - (this.passedTests.length + this.failedTests.length);
    if (this.hasBailed && skipped > 0) {
      logger.log("    Skipped: " + skipped);
    }

    const flushNextListener = () => {
      if (this.listeners.length === 0) {
        // There are no listeners left to flush. We've summarized all build reports.
        deferred.resolve();
      } else {
        // flush listeners in the same order we added them to the listeners list
        const listener = this.listeners.shift();
        if (typeof listener.flush === "function") {
          // This listener implements flush. Run it and check if the result is a promise
          // in case we need to wait on the listener to finish a long-running task first.
          const promise = listener.flush();
          if (promise && typeof promise.then === "function") {
            // This is a listener that returns a promise. Wait and then flush.
            promise
              .then(flushNextListener)
              .catch((error) => {
                logger.log("Error when flushing listener output: ", error);
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
    };

    flushNextListener();

    return deferred.promise;
  }

  // Handle an empty work queue:
  // Display a build summary and then either signal success or failure.
  buildFinished() {
    this.setTimeout(() => {
      this.summarizeCompletedBuild().then(() => {
        if (this.failedTests.length === 0) {
          this.onSuccess();
        } else {
          this.onFailure(this.failedTests);
        }
      });
    }, FINAL_CLEANUP_DELAY, true);
  }

  // Completion callback called by async.queue when a test is completed
  onTestComplete(error, test) {
    if (this.hasBailed) {
      // Ignore results from this test if we've bailed. This is likely a test that
      // was killed when the build went into bail mode.
      logger.log("\u2716 " + clc.redBright("KILLED ") + " " + test.toString()
        + (this.serial ? "\n" : ""));
      return;
    }

    const successful = test.status === Test.TEST_STATUS_SUCCESSFUL;
    let testRequeued = false;

    if (successful) {
      // Add this test to the passed test list, then remove it from the failed test
      // list (just in case it's a test we just retried after a previous failure).
      this.passedTests.push(test);
      this.failedTests = _.difference(this.failedTests, this.passedTests);
    } else {

      if (this.settings.gatherTrends) {
        const key = test.toString();
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
      }
    }

    let prefix;
    let suffix;

    if (this.serial) {
      prefix = "(" + (this.passedTests.length + this.failedTests.length) + " / "
        + this.numTests + ")";
      suffix = "";
    } else {
      prefix = "(" + (this.passedTests.length + this.failedTests.length) + " / "
        + this.numTests + ") <-- Worker " + test.workerIndex;
      suffix = "";
    }

    const requeueNote = testRequeued ? clc.cyanBright("(will retry).  Spent "
      + test.getRuntime() + " msec") : "";
    logger.log(prefix + " "
      + (successful ? clc.greenBright("PASS ") : clc.redBright("FAIL ")) + requeueNote + " "
      + test.toString() + " " + suffix);

    this.checkBuild();
  }

  // Check to see how the build is going and optionally fail the build early.
  checkBuild() {
    if (!this.hasBailed && this.THRESHOLD_MIN_ATTEMPTS) {
      // Kill the rest of the queue, preventing any new tests from running and shutting
      // down buildFinished
      this.q.kill();

      // Set a bail flag. Effects:
      //   1. Ignore results from any remaining tests that are still running.
      //   2. Signal to any running sentries that we should kill any running tests.
      this.hasBailed = true;

      this.buildFinished();
    }
  }

  // Return true if this build should stop running and fail immediately.
  shouldBail() {
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

      const sumAttempts = (memo, test) => memo + test.attempts;
      const totalAttempts = _.reduce(this.passedTests, sumAttempts, 0)
        + _.reduce(this.failedTests, sumAttempts, 0);

      // Failed attempts are not just the sum of all failed attempts but also
      // of successful tests that eventually passed (i.e. total attempts - 1).
      const sumExtraAttempts = (memo, test) => memo + Math.max(test.attempts - 1, 0);
      const failedAttempts = _.reduce(this.failedTests, sumAttempts, 0)
        + _.reduce(this.passedTests, sumExtraAttempts, 0);

      // Fail to total work ratio.
      const ratio = failedAttempts / totalAttempts;

      if (totalAttempts > strictness.THRESHOLD_MIN_ATTEMPTS) {
        if (ratio > strictness.THRESHOLD) {
          logger.log("Magellan has seen at least " + (strictness.THRESHOLD * 100) + "% of "
            + " tests fail after seeing at least " + strictness.THRESHOLD_MIN_ATTEMPTS
            + " tests run. Bailing early.");
          return true;
        }
      }
      return false;
    } else if (this.strictness === strictness.BAIL_FAST) {
      // --bail_fast
      // Bail as soon as a test has failed.
      return this.failedTests.length > 0;
    } else {
      return false;
    }
  }
}

module.exports = TestRunner;
