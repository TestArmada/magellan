/* eslint complexity: 0, no-invalid-this: 0, prefer-const: 0 */
"use strict";

// TODO: Extract trending into another class
// TODO: Move bailFast to a strategy pattern implementation

const _ = require("lodash");
const clc = require("cli-color");
const prettyMs = require("pretty-ms");
const path = require("path");
const once = require("once");
const fs = require("fs");
const mkdirSync = require("./util/mkdir_sync");
const guid = require("./util/guid");
const ChildProcessHandler = require("./util/childProcess");
const sanitizeFilename = require("sanitize-filename");
const analytics = require("./global_analytics");
const TestQueue = require("./test_queue");
const constants = require("./constants");

const settings = require("./settings");
const Test = require("./test");
const logger = require("./logger");

const WORKER_START_DELAY = 1000;
const WORKER_STOP_DELAY = 1500;
const WORKER_POLL_INTERVAL = 250;
const FINAL_CLEANUP_DELAY = 2500;

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
      settings,
      setTimeout,
      clearInterval,
      setInterval
    }, opts);

    this.buildId = this.settings.buildId;

    this.strategies = options.strategies;

    this.MAX_WORKERS = this.settings.MAX_WORKERS;

    this.MAX_TEST_ATTEMPTS = this.settings.MAX_TEST_ATTEMPTS;

    this.profiles = options.profiles;
    this.executors = options.executors;

    this.debug = this.settings.debug;
    this.debugVerbose = this.settings.debugVerbose;

    this.serial = this.settings.serial;

    this.enablePassedTestsLogging = this.settings.enablePassedTestsLogging;

    this.listeners = options.listeners || [];

    this.onFinish = options.onFinish;

    this.allocator = options.allocator;
    // For each actual test path, split out
    const testsXprofiles = _.flatten(
      tests.map((testLocator) =>
        options.profiles.map((profile) =>
          new Test(
            testLocator,
            profile,
            this.executors[profile.executor],
            this.MAX_TEST_ATTEMPTS))));

    if (this.settings.gatherTrends) {
      this.trends = {
        failures: {}
      };
      logger.log("Gathering trends to ./trends.json");
    }

    this.queue = new TestQueue({
      tests: testsXprofiles,
      workerAmount: this.MAX_WORKERS,

      stageTestHandler: this.stageTestHandler.bind(this),
      completeTestHandler: this.completeTestHandler.bind(this),
      completeQueueHandler: this.completeQueueHandler.bind(this)
    });
  }
  /* eslint-disable no-unused-vars,max-nested-callbacks */
  stageTestHandler(test, callback) {
    // check resource strategy
    this.strategies.resource
      .holdTestResource({ test })
      .then((profile) => {
        // resource is ready, proceed test execution
        const analyticsGuid = guid();
        test.executor.setupTest((setupTestErr, token) => {
          if (setupTestErr) {
            return callback(setupTestErr, test);
          }

          analytics.push(`acquire-worker-${analyticsGuid}`);
          this.allocator.get((getWorkerError, worker) => {
            if (getWorkerError) {
              return callback(getWorkerError, test);
            }

            analytics.mark(`acquire-worker-${analyticsGuid}`);

            this.runTest(test, worker)
              .then((runResults) => {
                // Give this worker back to the allocator
                /*eslint-disable max-nested-callbacks*/
                test.executor.teardownTest(token,
                  () => this.allocator.release(worker));

                test.workerIndex = worker.index;
                _.merge(test, runResults);

                // Pass or fail the test
                if (runResults.error) {
                  test.attempts++;
                  test.fail(test.attempts);
                } else {
                  test.pass();
                }

                return callback(null, test);
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
                test.executor.teardownTest(token,
                  () => this.allocator.release(worker));

                test.workerIndex = worker.index;
                test.error = runTestError;
                test.stdout = "";
                test.stderr = runTestError;
                test.attempts++;

                test.fail(test.attempts);
                return callback(runTestError, test);
              });
          });

        });
      })
      .catch((err) => {
        // no resource is available for current test
        // we put test back to the queue
        logger.warn(`No available resource for ${test.toString()},` +
          " we'll put it back in the queue.");

        // increase test resourceAttempts
        test.resourceAttempts++;

        if (test.resourceAttempts > test.maxResourceAttempts) {
          // we fail this test due to max resource retry
          test.fail(test.maxAttempts);
        }

        return callback(err, test);
      });

  }

  completeQueueHandler() {

    this.setTimeout(() => {

      this.logTestsSummary();
      // flushing all listeners
      Promise
        .all(
          _.map(this.listeners,
            (listener) => new Promise((innerResolve) => {
              listener
                .flush()
                .then(() => innerResolve())
                .catch((err) => {
                  logger.err(`Error when flushing listener output: ${err}. ` +
                    "This error doesn't impact test result");
                  // we eat this error and contiue the listner.flush()
                  return innerResolve();
                });
            })))
        .then(() => this.onFinish(this.queue.getFailedTests()));
    }, FINAL_CLEANUP_DELAY, true);
  }

  run() {
    this.startTime = (new Date()).getTime();

    const profileStatement = this.profiles.map((b) => b.toString()).join(", ");
    const serialStatement = this.serial ? "in serial mode" : `with ${this.MAX_WORKERS} workers`;

    logger.log(`Running ${this.queue.getTestAmount()} tests`
      + ` ${serialStatement} with [${profileStatement}]`);

    return this.queue.proceed();
  }

  // Spawn a process for a given test run
  // Return a promise that resolves with test results after test has been run.
  // Rejections only happen if we encounter a problem with magellan itself, not
  // Rejections only happen if we encounter a problem with magellan itself, not
  // the test. The test will resolve with a test result whether it fails or passes.
  execute(testRun, test) {
    return new Promise((resolve, reject) => {

      if (_.isFunction(testRun.enableExecutor)) {
        // if we have addExecutor defined in test run (new in magellan 10.0.0)
        testRun.enableExecutor(test.executor);
      }

      let env;
      try {
        env = testRun.getEnvironment(this.settings.environment);
      } catch (err) {
        return reject(err);
      }

      const options = {
        env,
        silent: true,
        detached: false,
        stdio: ["pipe", "pipe", "pipe", "ipc"]
      };

      let childProcess;
      try {
        //////////////////////////////////////////////////
        childProcess = new ChildProcessHandler(
          this.executors[test.profile.executor]
            .execute(testRun, options)
        );

        if (!this.queue.isIdle()) {
          // we transitioned from being idle to being busy
          analytics.mark("magellan-busy", "busy");
        }
      } catch (err) {
        return reject(err);
      }

      let sentry;

      let testMetadata;

      try {
        // Attach listeners that respond to messages sent from the running test.
        // These messages are sent with process.send()
        this.listeners.forEach((listener) => {
          if (_.isFunction(listener.listenTo)) {
            listener.listenTo(testRun, test, childProcess.emitter);
          }
        });

        childProcess.emitMessage({
          type: "worker-status",
          status: "started",
          name: test.locator.toString()
        });

      } catch (err) {
        return reject(err);
      }

      childProcess.emitMessage({
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
            attemptNumber: test.attempts + 1
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
      const closeWorker = once((code) => {

        if (this.queue.isIdle()) {
          // we transitioned from being busy into being idle
          analytics.mark("magellan-busy", "idle");
        }

        childProcess.emitMessage({
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

        childProcess.emitMessage({
          type: "worker-status",
          status: "finished",
          name: test.locator.toString(),
          passed: code === 0,
          metadata: testMetadata
        });

        // Detach ALL listeners that may have been attached
        childProcess.teardown();

        test.executor.summerizeTest(
          this.buildId,
          {
            result: code === 0,
            metadata: testMetadata
          },
          (additionalLog) => resolve({
            error: code === 0 ? null : "Child test run process exited with code " + code,
            stderr: childProcess.stderr,
            stdout: childProcess.stdout +
              (additionalLog && typeof additionalLog === "string" ? additionalLog : "")
          })
        );
      });

      if (this.debugVerbose) {
        // For debugging purposes.
        childProcess.enableDebugMsg();
      }

      //
      // Via IPC, capture the current selenium session id.
      // Reporters and listeners can exploit this to tie certain runtime artifacts to the unique
      // identity of the test run.
      //
      // FIXME: make it possible to receive this information from test
      //        frameworks not based on nodejs
      //

      childProcess.onMessage((message) => {
        if (message.type === "test-meta-data") {
          testMetadata = message.metadata;
        }
      });

      childProcess.onClose(closeWorker);

      // A sentry monitors how long a given worker has been working.
      // If bail strategy calls a bail, we kill a worker process and its
      // process tree if its been running for too long.
      test.startClock();

      sentry = this.setInterval(() => {
        const runtime = test.getRuntime();

        if (this.strategies.bail.hasBailed || runtime > settings.testTimeout) {
          // Suite won't be bailed if test is killed by exceeding settings.testTimeout
          // Stop the sentry now because we are going to yield for a moment before
          // calling workerClosed(), which is normally responsible for stopping
          // the sentry from monitoring.
          this.clearInterval(sentry);

          let customMessage = "Killed by Magellan because of"
            + ` ${this.strategies.bail.getBailReason()}`;

          // Tell the child to shut down the running test immediately
          if (runtime > settings.testTimeout) {
            customMessage = `Killed by Magellan after ${settings.testTimeout}ms`
              + " (long running test)";
          }

          childProcess.send({
            signal: "bail",
            customMessage
          });

          this.setTimeout(() => {
            // We pass code 1 to simulate a failure return code from fork()
            closeWorker(1);
          }, WORKER_STOP_DELAY);

        } else {
          return;
        }
      }, WORKER_POLL_INTERVAL);

    });
  }

  // Run a test with a given worker.
  // with a modified version of the test that contains its run status
  runTest(test, worker) {
    return new Promise((resolve, reject) => {

      // do not report test starts if we've bailed.
      if (!this.strategies.bail.hasBailed) {
        const mode = this.serial ? "Serial mode" : `Worker ${worker.index}`;
        const token = worker.token ? `vm token: ${worker.token}` : "";

        const msg = `--> ${mode}, port range: ` +
          `[${worker.portOffset}, ${worker.portOffset + settings.BASE_PORT_SPACING - 1}], ` +
          `${token} ` +
          `${test.toString()}`;

        logger.log(msg);
      }

      try {
        const TestRunClass = this.settings.testFramework.TestRun;
        const childBuildId = guid();

        // Note: we must sanitize the buildid because it might contain slashes or "..", etc
        const tempAssetPath = path.resolve(this.settings.tempDir + "/build-"
          + sanitizeFilename(this.buildId) + "_" + childBuildId + "__temp_assets");

        mkdirSync(tempAssetPath);

        // magellan default port rule
        let ports = {
          seleniumPort: worker.portOffset,
          mockingPort: null
        };

        if (settings.BASE_PORT_SPACING > 1) {
          ports.mockingPort = worker.portOffset + 1;
        }

        // if executor has its own port rule
        if (test.executor.getPorts
          && _.isFunction(test.executor.getPorts)) {
          ports = test.executor.getPorts({
            portOffset: worker.portOffset,
            portIndent: settings.BASE_PORT_SPACING
          });
        }

        const testRun = new TestRunClass(_.assign({
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

        this.setTimeout(
          () => this.execute(testRun, test)
            .then((testResult) =>
              this.strategies.resource
                .releaseTestResource({ test, token: worker.token })
                .then(() => Promise.resolve(testResult))
            )
            .then((testResult) => resolve(testResult))
            .catch((err) => reject(err)),
          WORKER_START_DELAY);
      } catch (err) {
        return reject(err);
      }
    });
  }

  gatherTrends() {
    if (this.settings.gatherTrends) {
      logger.log("Updating trends ...");

      let existingTrends;

      try {
        existingTrends = JSON.parse(fs.readFileSync("./trends.json"));
      } catch (e) {
        existingTrends = { failures: {} };
      }

      Object.keys(this.trends.failures).forEach((key) => {
        const localFailureCount = this.trends.failures[key];
        /*eslint-disable no-magic-numbers*/
        existingTrends.failures[key] = existingTrends.failures[key] > -1
          ? existingTrends.failures[key] + localFailureCount : localFailureCount;
      });

      fs.writeFileSync("./trends.json", JSON.stringify(existingTrends, null, 2));

      logger.log("Updated trends at ./trends.json");
    }
  }

  // Print information about a completed build to the screen, showing failures and
  // bringing in any information from listeners
  logTestsSummary() {
    const retryMetrics = {};

    const failedTests = this.queue.getFailedTests();
    const passedTests = this.queue.getPassedTests();

    this.gatherTrends();

    if (!_.isEmpty(failedTests)) {
      analytics.mark("magellan-run", "failed");

      if (!this.serial) {
        // only output failed test logs in non-serial mode
        logger.log(clc.redBright("============= Failed Tests:  ============="));

        _.forEach(failedTests, (test) => {
          logger.warn("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -");
          logger.warn(`      Failed Test:  ${test.toString()}`);
          logger.warn(`       # attempts:  ${test.attempts}`);
          logger.warn("From last attempt: \n");
          logger.loghelp(test.stdout);
          logger.loghelp(test.stderr);
        });
      }

    } else {
      if (this.enablePassedTestsLogging) {
        if (!this.serial) {
          // only output passed test logs in non-serial mode
          logger.log(clc.greenBright("============= Passed Tests:  ============="));

          _.forEach(passedTests, (test) => {
            logger.warn("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -");
            logger.warn(`      Passed Test:  ${test.toString()}`);
            logger.warn(`       # attempts:  ${test.attempts}`);
            logger.warn("From last attempt: \n");
            logger.loghelp(test.stdout);
            logger.loghelp(test.stderr);
          });
        }
      }

      analytics.mark("magellan-run", "passed");
    }

    let status = failedTests.length > 0 ?
      clc.redBright("FAILED") :
      clc.greenBright("PASSED");

    if (this.strategies.bail.hasBailed) {
      status += clc.redBright(` due to bail strategy: ${this.strategies.bail.getBailReason()}`);
    }

    this.queue.tests.forEach((test) => {
      if (test.status === Test.TEST_STATUS_SUCCESSFUL
        && test.getRetries() > 0) {
        if (retryMetrics[test.getRetries()]) {
          retryMetrics[test.getRetries()]++;
        } else {
          retryMetrics[test.getRetries()] = 1;
        }
      }
    });

    logger.log(clc.greenBright("============= Suite Complete ============="));
    logger.log(`     Status:  ${status}`);
    logger.log(`    Runtime:  ${prettyMs((new Date()).getTime() - this.startTime)}`);
    logger.log(`Total tests:  ${this.queue.getTestAmount()}`);
    logger.log(`     Passed:  ${passedTests.length} / ${this.queue.getTestAmount()}`);

    _.forOwn(retryMetrics, (testCount, numRetries) => {
      logger.log(`${testCount} test(s) have retried: ${numRetries} time(s)`);
    });

    if (!_.isEmpty(failedTests)) {
      logger.log(`     Failed:  ${failedTests.length} / ${this.queue.getTestAmount()}`);
    }

    const skipped = this.queue.getTestAmount() - (passedTests.length + failedTests.length);
    if (this.strategies.bail.hasBailed && skipped > 0) {
      logger.log(`    Skipped:  ${skipped}`);
    }
  }

  // Completion callback called by async.queue when a test is completed
  completeTestHandler(error, test) {

    if (this.strategies.bail.hasBailed) {
      // Ignore results from this test if we've bailed by PREVIOUS tests. This is likely a test that
      // was killed when the build went into bail mode.
      logger.warn(`\u2716 ${clc.redBright("KILLED")} ${test.toString()} `
        + `${this.serial ? "\n" : ""}`);

      // if we land here current test should be marked as skipped even though
      // nightwatch marks it as failed
      test.status = Test.TEST_STATUS_SKIPPED;
      return;
    }

    let status = clc.greenBright("PASS");
    let enqueueNote = "";

    /* eslint-disable indent */
    switch (test.status) {
      case Test.TEST_STATUS_SUCCESSFUL:
        // Add this test to the passed test list, then remove it from the failed test
        // list (just in case it's a test we just retried after a previous failure).
        break;
      case Test.TEST_STATUS_FAILED:
        status = clc.redBright("FAIL");

        if (this.settings.gatherTrends) {
          const key = test.toString();
          /*eslint-disable no-magic-numbers*/
          this.trends.failures[key] = this.trends.failures[key] > -1
            ? this.trends.failures[key] + 1 : 1;
        }

        // if suite should bail due to failure
        this.strategies.bail.shouldBail({
          totalTests: this.queue.tests,
          passedTests: this.queue.getPassedTests(),
          failedTests: this.queue.getFailedTests()
        });

        // Note: Tests that failed but can still run again are pushed back into the queue.
        // This push happens before the queue is given back flow control (at the end of
        // this callback), which means that the queue isn't given the chance to drain.
        if (!test.canRun()) {
          this.queue.enqueue(test, constants.TEST_PRIORITY.RETRY);

          enqueueNote = clc.cyanBright(`(will retry, ${test.maxAttempts - test.attempts}` +
            ` time(s) left). Spent ${test.getRuntime()} ms`);
        }
        break;
      case Test.TEST_STATUS_NEW:
        // no available resource
        status = clc.yellowBright("RETRY");
        this.queue.enqueue(test, constants.TEST_PRIORITY.RETRY);

        enqueueNote = clc.cyanBright("(will retry). ") + clc.redBright(error.message);
        break;
    }

    const failedTests = this.queue.getFailedTests();
    const passedTests = this.queue.getPassedTests();

    let prefix = `(${failedTests.length + passedTests.length} ` +
      `/ ${this.queue.getTestAmount()})`;

    if (test.attempts > 1) {
      // this is a retry
      prefix = "(retry)";
    }

    if (!this.serial && test.workerIndex > 0) {
      prefix += ` <-- Worker ${test.workerIndex}`;
    }

    logger.log(`${prefix} ${status} ${enqueueNote} ${test.toString()}`);

    if (this.strategies.bail.hasBailed) {
      // we handle bail for CURRENT test here
      // Kill the rest of the queue, preventing any new tests from running and shutting
      // down buildFinished
      return this.queue.earlyTerminate();
    }
  }
}

module.exports = TestRunner;
