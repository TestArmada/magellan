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
const co = require("co");
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

const BailStrategy = require("./strategies/bail");
const ResourceStrategy = require("./strategies/resource");

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

  // const isNodeBased = runOpts.margs.argv.framework &&
  //   runOpts.margs.argv.framework.indexOf("mocha") > -1;

  const debug = runOpts.margs.argv.debug || false;
  const useSerialMode = runOpts.margs.argv.serial;
  let MAX_TEST_ATTEMPTS = parseInt(runOpts.margs.argv.max_test_attempts) || 3;
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

  logger.log("Loaded test framework: ");
  logger.log("  " + runOpts.settings.framework);
  //
  // Initialize Executor
  // ============================
  // TODO: move to a function
  // TODO: move to a function
  // let formalExecutor = ["local"];
  let formalExecutors = ["testarmada-magellan-local-executor"];

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
  const executorLoadExceptions = [];
  runOpts.settings.testExecutors = {};

  _.forEach(runOpts.settings.executors, (executor) => {
    try {
      const targetExecutor = runOpts.require(executor);
      targetExecutor.validateConfig(runOpts);
      runOpts.settings.testExecutors[targetExecutor.shortName] = targetExecutor;
    } catch (e) {
      executorLoadExceptions.push(e);
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

  logger.log("Loaded test executors: ");
  _.forEach(runOpts.settings.testExecutors, (executor) => {
    logger.log("  " + executor.name);
  });

  const testExecutors = runOpts.settings.testExecutors;

  //
  // Initialize Strategy
  // ====================

  if (!runOpts.settings.strategies) {
    runOpts.settings.strategies = {};
  }


  //
  // Initialize Strategies
  // ====================

  // Strategy - bail --------------------
  try {
    runOpts.settings.strategies.bail =
      new BailStrategy(runOpts.margs.argv);

    if (runOpts.settings.strategies.bail.MAX_TEST_ATTEMPTS) {
      // backward support
      // bail strategy can define its own test attempts
      MAX_TEST_ATTEMPTS = runOpts.settings.strategies.bail.MAX_TEST_ATTEMPTS;
    }

    logger.log("Enabled bail strategy: ");
    logger.log(`  ${runOpts.settings.strategies.bail.name}: `
      + `${runOpts.settings.strategies.bail.getDescription()}`);
  } catch (e) {
    logger.err(`Error: bail strategy: ${bailRule}`
      + `cannot be loaded because of error [${e}]`);
    defer.reject({ error: "Couldn't start Magellan" });
  }

  // Strategy - resource --------------------
  try {
    runOpts.settings.strategies.resource =
      new ResourceStrategy(runOpts.margs.argv);

    logger.log("Enabled resource strategy: ");
    logger.log(`  ${runOpts.settings.strategies.resource.name}: `
      + `${runOpts.settings.strategies.resource.getDescription()}`);
  }
  catch (e) {
    logger.err(`Resource strategy: ${resourceRule}`
      + ` cannot be loaded because of error [${e}]`);
    defer.reject({ error: "Couldn't start Magellan" });
  }

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
  // Serial Mode Reporter (enabled with --serial)
  //
  if (useSerialMode) {
    const StdoutReporter = runOpts.require("./reporters/stdout/reporter");
    listeners.push(new StdoutReporter());
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
    magellanGlobals.workerAmount = MAX_WORKERS;

    return new Promise((resolve, reject) => {
      async.each(listeners, (listener, done) => {
        listener.initialize(magellanGlobals)
          .then(() => done())
          .catch((err) => done(err));
      }, (err) => {
        if (err) {
          return reject(err);
        } else {
          return resolve();
        }
      });
    });
  };

  const startSuite = () => {
    return new Promise((resolve, reject) => {

      Promise
        .all(_.map(testExecutors, (executor) => executor.setupRunner()))
        .then(() => {
          workerAllocator.initialize((workerInitErr) => {
            if (workerInitErr) {
              logger.err("Could not start Magellan. Got error while initializing"
                + " worker allocator");
              return reject(workerInitErr);
            }

            const testRunner = new runOpts.TestRunner(tests, {
              debug,

              maxWorkers: MAX_WORKERS,

              maxTestAttempts: MAX_TEST_ATTEMPTS,

              profiles: targetProfiles,
              executors: testExecutors,

              listeners,

              strategies: runOpts.settings.strategies,

              serial: useSerialMode,

              allocator: workerAllocator,

              onSuccess: () => {
                /*eslint-disable max-nested-callbacks*/
                workerAllocator.teardown(() => {
                  Promise
                    .all(_.map(testExecutors, (executor) => executor.teardownRunner()))
                    .then(() => {
                      runOpts.processCleanup(() => {
                        return resolve();
                      });
                    })
                    .catch((err) => {
                      // we eat error here
                      logger.warn("executor teardownRunner error: " + err);
                      runOpts.processCleanup(() => {
                        return resolve();
                      });
                    });
                });
              },

              onFailure: (/*failedTests*/) => {
                /*eslint-disable max-nested-callbacks*/
                workerAllocator.teardown(() => {
                  Promise
                    .all(_.map(testExecutors, (executor) => executor.teardownRunner()))
                    .then(() => {
                      runOpts.processCleanup(() => {
                        // Failed tests are not a failure in Magellan itself,
                        // so we pass an empty error here so that we don't
                        // confuse the user. Magellan already outputs a failure
                        // report to the screen in the case of failed tests.
                        return reject(null);
                      });
                    })
                    .catch((err) => {
                      logger.warn("executor teardownRunner error: " + err);
                      // we eat error here
                      runOpts.processCleanup(() => {
                        return reject(null);
                      });
                    });
                });
              }
            });

            testRunner.start();
          });
        })
        .catch((err) => {
          return reject(err);
        });
    });
  };

  const enableExecutors = (_targetProfiles) => {
    // this is to allow magellan to double check with profile that
    // is retrieved by --profile or --profiles
    targetProfiles = _targetProfiles;

    console.log(targetProfiles)

    return new Promise((resolve, reject) => {
      try {
        _.forEach(
          _.uniq(_.map(_targetProfiles, (targetProfile) => targetProfile.executor)),
          (shortname) => {
            if (runOpts.settings.testExecutors[shortname]) {
              runOpts.settings.testExecutors[shortname].validateConfig({ isEnabled: true });
            }
          });

        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  };

  // runOpts.profiles
  //   .detectFromCLI(runOpts)
  //   .then(enableExecutors)
  //   .then(() => {
  //     //
  //     // Worker Count:
  //     // =============
  //     //
  //     //   Default to 3 workers in parallel mode (default).
  //     //   Default to 1 worker in serial mode.
  //     //
  //     MAX_WORKERS = useSerialMode ? 1 : parseInt(runOpts.margs.argv.max_workers) || 3;
  //     workerAllocator = new runOpts.WorkerAllocator(MAX_WORKERS);
  //   })
  //   .then(initializeListeners)
  //   // NOTE: if we don't end up in catch() below, magellan exits with status code 0 naturally
  //   .then(startSuite)
  //   .then(() => {
  //     defer.resolve();
  //   })
  //   .catch((err) => {
  //     if (err) {
  //       logger.err("Error initializing Magellan");
  //       logger.err("Error description:");
  //       logger.err(err.toString());
  //       logger.err("Error stack trace:");
  //       logger.err(err.stack);
  //     } else {
  //       // No err object means we didn't have an internal crash while setting up / tearing down
  //     }

  //     // Fail the test suite or fail because of an internal crash
  //     defer.reject({ error: "Internal crash" });
  //   });

  return co(function* () {
    const targetProfile = yield runOpts.profiles.detectFromCLI(runOpts);
    console.log(targetProfile)
    // return targetProfile;
    defer.resolve(targetProfile)
  }).catch((err) => {
    logger.warn(err);
    defer.reject(err)
  });

  return defer.promise;
};
