#!/usr/bin/env node

"use strict";
/*eslint-disable no-magic-numbers*/
/*eslint-disable global-require*/
/*eslint-disable complexity*/

// Note: this script assumes you run this from the same directory as where
// the package.json that contains magellan resides. In addition
// configuration must either be explicitly specified relative to that directory
// or absolutely (or exist implicitly in the default location)

const yargs = require("yargs");
const path = require("path");
const _ = require("lodash");
const margs = require("marge");
const async = require("async");
const Q = require("q");

const analytics = require("./global_analytics");
const TestRunner = require("./test_runner");
const getTests = require("./get_tests");
const testFilters = require("./test_filter");
const WorkerAllocator = require("./worker_allocator");
const settings = require("./settings");
const profiles = require("./profiles");
const loadRelativeModule = require("./util/load_relative_module");
const processCleanup = require("./util/process_cleanup");
const magellanArgs = require("./help").help;
const logger = require("./logger");

module.exports = (opts) => {
  const defer = Q.defer();

  const runOpts = _.assign({
    require,
    analytics,
    settings,
    yargs,
    margs,
    WorkerAllocator,
    TestRunner,
    process,
    getTests,
    testFilters,
    processCleanup,
    profiles,
    path,
    loadRelativeModule
  }, opts);

  const project = runOpts.require("../package.json");

  logger.log("Magellan " + project.version);

  const defaultConfigFilePath = "./magellan.json";
  const configFilePath = runOpts.yargs.argv.config;

  if (configFilePath) {
    logger.log("Will try to load configuration from " + configFilePath);
  } else {
    logger.log("Will try to load configuration from default of " + defaultConfigFilePath);
  }

  // NOTE: marge can throw an error here if --config points at a file that doesn't exist
  // FIXME: handle this error nicely instead of printing an ugly stack trace
  runOpts.margs.init(defaultConfigFilePath, configFilePath);

  const isNodeBased = runOpts.margs.argv.framework &&
    runOpts.margs.argv.framework.indexOf("mocha") > -1;

  const debug = runOpts.margs.argv.debug || false;
  const useSerialMode = runOpts.margs.argv.serial;
  const MAX_TEST_ATTEMPTS = parseInt(runOpts.margs.argv.max_test_attempts) || 3;
  let targetProfiles;
  let workerAllocator;
  let MAX_WORKERS;

  const magellanGlobals = {
    analytics: runOpts.analytics
  };

  runOpts.analytics.push("magellan-run");
  runOpts.analytics.push("magellan-busy", undefined, "idle");

  //
  // Initialize Framework Plugins
  // ============================
  // TODO: move to a function

  // We translate old names like "mocha" to the new module names for the
  // respective plugins that provide support for those frameworks. Officially,
  // moving forward, we should specify our framework (in magellan.json)
  const legacyFrameworkNameTranslations = {
    "rowdy-mocha": "testarmada-magellan-mocha-plugin",
    "vanilla-mocha": "testarmada-magellan-mocha-plugin",
    "nightwatch": "testarmada-magellan-nightwatch-plugin"
  };

  if (legacyFrameworkNameTranslations[runOpts.settings.framework]) {
    runOpts.settings.framework = legacyFrameworkNameTranslations[runOpts.settings.framework];
  }

  let frameworkLoadException;
  try {
    //
    // HELP WANTED: If someone knows how to do this more gracefully, please contribute!
    //
    const frameworkModulePath = "./node_modules/" + runOpts.settings.framework + "/index";
    runOpts.settings.testFramework = runOpts.require(runOpts.path.resolve(frameworkModulePath));
  } catch (e) {
    frameworkLoadException = e;
  }

  let frameworkInitializationException;
  try {
    const pkg = runOpts.require(runOpts.path.join(runOpts.process.cwd(), "package.json"));

    runOpts.settings.pluginOptions = null;
    if (runOpts.settings.testFramework.getPluginOptions
      && typeof runOpts.settings.testFramework.getPluginOptions === "function") {
      // backward support
      runOpts.settings.pluginOptions
        = runOpts.settings.testFramework.getPluginOptions(
          {
            rootPackage: pkg,
            rootWorkingDirectory: runOpts.process.cwd()
          });
    }
    runOpts.settings.testFramework.initialize(runOpts.margs.argv, runOpts.settings.pluginOptions);
  } catch (e) {
    frameworkInitializationException = e;
  }

  if (!runOpts.settings.testFramework ||
    frameworkLoadException ||
    frameworkInitializationException) {
    logger.err("Could not start Magellan.");
    if (frameworkLoadException) {
      logger.err("Could not load the testing framework plugin '"
        + runOpts.settings.framework + "'.");
      logger.err("Check and make sure your package.json includes a module named '"
        + runOpts.settings.framework + "'.");
      logger.err("If it does not, you can remedy this by typing:"
        + "\nnpm install --save " + runOpts.settings.framework);
      logger.err(frameworkLoadException);
    } else /* istanbul ignore else */ if (frameworkInitializationException) {
      logger.err("Could not initialize the testing framework plugin '"
        + runOpts.settings.framework + "'.");
      logger.err("This plugin was found and loaded, but an error occurred during initialization:");
      logger.err(frameworkInitializationException);
    }

    defer.reject({ error: "Couldn't start Magellan" });
  }


  //
  // Initialize Executor
  // ============================
  // TODO: move to a function
  // TODO: move to a function
  // let formalExecutor = ["local"];
  let formalExecutors = ["./node_modules/testarmada-magellan/src/executor/local"];

  // executors is as array from magellan.json by default
  if (runOpts.margs.argv.executors) {
    if (_.isArray(runOpts.margs.argv.executors)) {
      formalExecutors = runOpts.margs.argv.executors;
    } else if (_.isString(runOpts.margs.argv.executors)) {
      formalExecutors = [runOpts.margs.argv.executors];
    } else {
      logger.err("Executors only accepts string and array");
      logger.warn("Setting executor to \"local\" by default");
    }
  } else {
    logger.warn("No executor is passed in");
    logger.warn("Setting executor to \"local\" by default");
  }

  runOpts.settings.executors = formalExecutors;

  // load executor
  let executorLoadExceptions = [];
  runOpts.settings.testExecutors = {};

  _.forEach(runOpts.settings.executors, (executor) => {
    try {
      const targetExecutor = runOpts.require(runOpts.path.resolve(executor));
      targetExecutor.validateConfig(runOpts);
      runOpts.settings.testExecutors[targetExecutor.shortName] = targetExecutor;
    } catch (e) {
      executorLoadException.push(e);
    }
  });

  if (executorLoadExceptions.length > 0) {
    // error happens while loading executor
    logger.err("There are errors in loading executors");
    _.forEach(executorLoadExceptions, (exception) => {
      logger.err(exception.toString());
    });

    defer.reject({ error: "Couldn't start Magellan" });
  }

  const testExecutors = runOpts.settings.testExecutors;

  // finish processing all params ===========================

  // Show help and exit if it's asked for
  if (runOpts.margs.argv.help) {
    const help = runOpts.require("./cli_help");
    help.help();
    defer.resolve(0);
    return defer.promise;
  }

  // handle executor specific params
  const executorParams = _.omit(runOpts.margs.argv, _.keys(magellanArgs));

  // ATTENTION: there should only be one executor param matched for the function call
  _.forEach(runOpts.settings.testExecutors, (v, k) => {
    _.forEach(executorParams, (epValue, epKey) => {
      if (v.help[epKey] && v.help[epKey].type === "function") {
        // we found a match in current executor
        // method name convention for an executor: PREFIX_string_string_string_...
        let names = epKey.split("_");
        names = names.slice(1, names.length);
        const executorMethodName = _.camelCase(names.join(" "));

        if (_.has(v, executorMethodName)) {
          // method found in current executor
          v[executorMethodName](runOpts, () => {
            defer.resolve();
          });
        } else {
          logger.err("Error: executor" + k + " doesn't has method " + executorMethodName + ".");
          defer.resolve();
        }
      }
    });
  });

  //
  // Initialize Listeners
  // ====================
  //
  // All listener/reporter types are optional and either activated through the existence
  // of configuration (i.e environment vars), CLI switches, or magellan.json config.
  let listeners = [];

  //
  // Setup / Teardown
  // ================
  //
  // This is merely a listener like any other reporter, but with a developer-friendly name.

  if (runOpts.margs.argv.setup_teardown) {
    // NOTE: loadRelativeModule can throw an error here if the setup module doesn't exist
    // FIXME: handle this error nicely instead of printing an ugly stack trace
    listeners.push(runOpts.loadRelativeModule(runOpts.margs.argv.setup_teardown));
  }

  //
  // Load reporters from magellan.json
  // =================================
  //
  // Reporters that conform to the reporter API and inherit from src/reporter
  // can be loaded in magellan.json through a reporters[] list. These can refer to
  // either npm modules defined in package.json or to paths relative to the current
  // working directory of the calling script or shell.
  if (runOpts.margs.argv.reporters && _.isArray(runOpts.margs.argv.reporters)) {
    // NOTE: loadRelativeModule can throw an error here if any of the reporter modules don't exist
    // FIXME: handle this error nicely instead of printing an ugly stack trace
    listeners = listeners.concat(runOpts.margs.argv.reporters.map(runOpts.loadRelativeModule));
  }

  // optional_reporters are modules we want to load only if found. If not found, we
  // still continue initializing Magellan and don't throw any errors or warnings
  if (runOpts.margs.argv.optional_reporters && _.isArray(runOpts.margs.argv.optional_reporters)) {
    listeners = listeners.concat(
      runOpts.margs.argv.optional_reporters.map((reporterModule) => {
        return runOpts.loadRelativeModule(reporterModule, true);
      })
    );
  }

  //
  // Slack integration (enabled if settings exist)
  //
  const slackSettings = runOpts.require("./reporters/slack/settings");
  if (slackSettings.enabled) {
    const Slack = runOpts.require("./reporters/slack/slack");
    const slackReporter = new Slack(slackSettings);
    listeners.push(slackReporter);
  }

  //
  // Serial Mode Reporter (enabled with --serial)
  //
  if (useSerialMode) {
    const StdoutReporter = runOpts.require("./reporters/stdout/reporter");
    listeners.push(new StdoutReporter());
  }

  //
  // Screenshot Aggregation (enabled with --aggregate_screenshots)
  //
  if (runOpts.settings.aggregateScreenshots) {
    const ScreenshotAggregator = runOpts.require("./reporters/screenshot_aggregator/reporter");
    listeners.push(new ScreenshotAggregator());
  }

  //
  // Find Tests, Start Worker Allocator
  //
  const tests = runOpts.getTests(runOpts.testFilters.detectFromCLI(runOpts.margs.argv));

  if (_.isEmpty(tests)) {
    logger.log("Error: no tests found");
    defer.reject({ error: "No tests found" });
    return defer.promise;
  }

  const initializeListeners = () => {
    const deferred = Q.defer();
    async.each(listeners, (listener, done) => {
      listener.initialize(magellanGlobals)
        .then(() => done())
        .catch((err) => done(err));
    }, (err) => {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
      }
    });
    return deferred.promise;
  };

  const startSuite = () => {
    const deferred = Q.defer();

    Promise
      .all(_.map(testExecutors, (executor) => executor.setup()))
      .then(() => {
        workerAllocator.initialize((workerInitErr) => {
          if (workerInitErr) {
            logger.err("Could not start Magellan. Got error while initializing"
              + " worker allocator");
            deferred.reject(workerInitErr);
            return defer.promise;
          }

          const testRunner = new runOpts.TestRunner(tests, {
            debug,

            maxWorkers: MAX_WORKERS,

            maxTestAttempts: MAX_TEST_ATTEMPTS,

            profiles: targetProfiles,
            executors: testExecutors,

            listeners,

            bailFast: runOpts.margs.argv.bail_fast ? true : false,
            bailOnThreshold: runOpts.margs.argv.bail_early ? true : false,

            serial: useSerialMode,

            allocator: workerAllocator,

            onSuccess: () => {
              /*eslint-disable max-nested-callbacks*/
              workerAllocator.teardown(() => {
                Promise
                  .all(_.map(testExecutors, (executor) => executor.teardown()))
                  .then(() => {
                    runOpts.processCleanup(() => {
                      deferred.resolve();
                    });
                  })
                  .catch((err) => {
                    // we eat error here
                    logger.warn("executor teardown error: " + err);
                    runOpts.processCleanup(() => {
                      deferred.resolve();
                    });
                  });
              });
            },

            onFailure: (/*failedTests*/) => {
              /*eslint-disable max-nested-callbacks*/
              workerAllocator.teardown(() => {
                Promise
                  .all(_.map(testExecutors, (executor) => executor.teardown()))
                  .then(() => {
                    runOpts.processCleanup(() => {
                      // Failed tests are not a failure in Magellan itself,
                      // so we pass an empty error here so that we don't
                      // confuse the user. Magellan already outputs a failure
                      // report to the screen in the case of failed tests.
                      deferred.reject(null);
                    });
                  })
                  .catch((err) => {
                    logger.warn("executor teardown error: " + err);
                    // we eat error here
                    runOpts.processCleanup(() => {
                      deferred.reject(null);
                    });
                  });
              });
            }
          });

          testRunner.start();
        });
      })
      .catch((err) => {
        deferred.reject(err);
      });

    return deferred.promise;
  };

  runOpts.profiles
    .detectFromCLI(runOpts)
    .then((_targetProfiles) => {
      targetProfiles = _targetProfiles;
      //
      // Worker Count:
      // =============
      //
      //   Default to 3 workers in parallel mode (default).
      //   Default to 1 worker in serial mode.
      //
      MAX_WORKERS = useSerialMode ? 1 : parseInt(runOpts.margs.argv.max_workers) || 3;
      workerAllocator = new runOpts.WorkerAllocator(MAX_WORKERS);
    })
    .then(initializeListeners)
    // NOTE: if we don't end up in catch() below, magellan exits with status code 0 naturally
    .then(startSuite)
    .then(() => {
      defer.resolve();
    })
    .catch((err) => {
      if (err) {
        logger.err("Error initializing Magellan");
        logger.err("\nError description:");
        logger.err(err.toString());
        logger.err("\nError stack trace:");
        logger.err(err.stack);
      } else {
        // No err object means we didn't have an internal crash while setting up / tearing down
      }

      // Fail the test suite or fail because of an internal crash
      defer.reject({ error: "Internal crash" });
    });

  return defer.promise;
};
