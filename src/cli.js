#!/usr/bin/env node

"use strict";
/*eslint-disable no-magic-numbers*/
/*eslint-disable global-require*/
/*eslint-disable complexity*/

// Note: this script assumes you run this from the same directory as where
// the package.json that contains magellan resides. In addition
// configuration must either be explicitly specified relative to that directory
// or absolutely (or exist implicitly in the default location)

const margs = require("marge");
const path = require("path");
const _ = require("lodash");
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

module.exports = {

  initialize() {

  },

  version(opts) {
    const project = require("../package.json");
    logger.log("Version: " + project.version);
  },

  loadFramework(opts) {
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

    if (legacyFrameworkNameTranslations[settings.framework]) {
      settings.framework = legacyFrameworkNameTranslations[settings.framework];
    }

    return new Promise((resolve, reject) => {

      let frameworkLoadException;
      try {
        //
        // HELP WANTED: If someone knows how to do this more gracefully, please contribute!
        //
        const frameworkModulePath = "./node_modules/" + settings.framework + "/index";
        settings.testFramework = require(path.resolve(frameworkModulePath));
      } catch (e) {
        frameworkLoadException = e;
      }

      let frameworkInitializationException;
      try {
        const pkg = require(path.join(process.cwd(), "package.json"));

        settings.pluginOptions = null;

        if (settings.testFramework.getPluginOptions
          && typeof settings.testFramework.getPluginOptions === "function") {
          // backward support
          settings.pluginOptions
            = settings.testFramework.getPluginOptions(
              {
                rootPackage: pkg,
                rootWorkingDirectory: process.cwd()
              });
        }
        settings.testFramework.initialize(opts.argv, settings.pluginOptions);
      } catch (e) {
        frameworkInitializationException = e;
      }

      if (!settings.testFramework ||
        frameworkLoadException ||
        frameworkInitializationException) {

        logger.err("Could not start Magellan.");

        if (frameworkLoadException) {
          logger.err(`Could not load the testing framework plugin: ${settings.framework}`);
          logger.err(`Check and make sure your package.json includes module: ${settings.framework}`);
          logger.err(frameworkLoadException);
        } else /* istanbul ignore else */ if (frameworkInitializationException) {
          logger.err(`Could not initialize the testing framework plugin: ${settings.framework}`);
          logger.err("This plugin was found and loaded, but an error occurred during initialization:");
          logger.err(frameworkInitializationException);
        }

        return reject("Couldn't start Magellan");
      }

      logger.log("Loaded test framework: ");
      logger.log(` ${settings.framework}`);
      return resolve();
    });
  },

  loadExecutors(opts) {
    // Initialize Executor
    // ============================
    // let formalExecutor = ["local"];
    let formalExecutors = ["testarmada-magellan-local-executor"];

    // executors is as array from magellan.json by default
    if (opts.argv.executors) {
      if (_.isArray(opts.argv.executors)) {
        formalExecutors = opts.argv.executors;
      } else if (_.isString(opts.argv.executors)) {
        formalExecutors = [opts.argv.executors];
      } else {
        logger.err("Executors only accepts string and array");
        logger.warn("Setting executor to [testarmada-magellan-local-executor] by default");
      }
    } else {
      logger.warn("No executor is configured");
      logger.warn("Setting executor to [testarmada-magellan-local-executor] by default");
    }

    settings.executors = formalExecutors;

    return new Promise((resolve, reject) => {
      // load executor
      const executorLoadExceptions = [];
      settings.testExecutors = {};

      logger.log("Loaded test executors: ");

      _.forEach(settings.executors, (executor) => {
        try {
          const targetExecutor = require(executor);
          logger.log("  " + targetExecutor.name);
          // targetExecutor.validateConfig(opts.argv);
          settings.testExecutors[targetExecutor.shortName] = targetExecutor;
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

        return reject("Couldn't start Magellan");
      }

      return resolve();
    });
  },

  loadStrategies(opts) {
    //
    // Initialize Strategy
    // ====================

    if (!settings.strategies) {
      settings.strategies = {};
    }

    return new Promise((resolve, reject) => {
      // Strategy - bail --------------------
      try {
        settings.strategies.bail =
          new BailStrategy(opts.argv);

        if (settings.strategies.bail.MAX_TEST_ATTEMPTS) {
          // backward support
          // bail strategy can define its own test attempts
          MAX_TEST_ATTEMPTS = settings.strategies.bail.MAX_TEST_ATTEMPTS;
        }

        logger.log("Enabled bail strategy: ");
        logger.log(`  ${settings.strategies.bail.name}:`);
        logger.log(`  -> ${settings.strategies.bail.getDescription()}`);
      } catch (err) {
        logger.err(`Cannot load bail strategy due to ${err}`);
        logger.err("Please npm install and configure it in magellan.json");
        return reject("Couldn't start Magellan");
      }

      // Strategy - resource --------------------
      try {
        settings.strategies.resource =
          new ResourceStrategy(opts.argv);

        logger.log("Enabled resource strategy: ");
        logger.log(`  ${settings.strategies.resource.name}:`);
        logger.log(`  -> ${settings.strategies.resource.getDescription()}`);
      }
      catch (err) {
        logger.err(`Cannot load resource strategy due to ${err}`);
        logger.err("Please npm install and configure in magellan.json");
        return reject("Couldn't start Magellan");
      }

      return resolve();
    });
  },


  detectProfiles(opts) {
    return profiles.detectFromCLI({ margs, settings });
  }


  // const defer = Q.defer();

  // const runOpts = _.assign({
  //   require,
  //   analytics,
  //   settings,
  //   yargs,
  //   margs,
  //   WorkerAllocator,
  //   TestRunner,
  //   process,
  //   getTests,
  //   testFilters,
  //   processCleanup,
  //   profiles,
  //   path,
  //   loadRelativeModule
  // }, opts);



  // // const isNodeBased = runOpts.margs.argv.framework &&
  // //   runOpts.margs.argv.framework.indexOf("mocha") > -1;

  // const debug = runOpts.margs.argv.debug || false;
  // const useSerialMode = runOpts.margs.argv.serial;
  // let MAX_TEST_ATTEMPTS = parseInt(runOpts.margs.argv.max_test_attempts) || 3;
  // let targetProfiles;
  // let workerAllocator;
  // let MAX_WORKERS;

  // const magellanGlobals = {
  //   analytics: runOpts.analytics
  // };


  // runOpts.analytics.push("magellan-run");
  // runOpts.analytics.push("magellan-busy", undefined, "idle");




  // // finish processing all params ===========================

  // // Show help and exit if it's asked for
  // if (runOpts.margs.argv.help) {
  //   const help = runOpts.require("./cli_help");
  //   help.help();
  //   defer.resolve(0);
  //   return defer.promise;
  // }

  // // handle executor specific params
  // const executorParams = _.omit(runOpts.margs.argv, _.keys(magellanArgs));

  // // ATTENTION: there should only be one executor param matched for the function call
  // _.forEach(runOpts.settings.testExecutors, (v, k) => {
  //   _.forEach(executorParams, (epValue, epKey) => {
  //     if (v.help[epKey] && v.help[epKey].type === "function") {
  //       // we found a match in current executor
  //       // method name convention for an executor: PREFIX_string_string_string_...
  //       let names = epKey.split("_");
  //       names = names.slice(1, names.length);
  //       const executorMethodName = _.camelCase(names.join(" "));

  //       if (_.has(v, executorMethodName)) {
  //         // method found in current executor
  //         v[executorMethodName](runOpts, () => {
  //           defer.resolve();
  //         });
  //       } else {
  //         logger.err("Error: executor" + k + " doesn't has method " + executorMethodName + ".");
  //         defer.resolve();
  //       }
  //     }
  //   });
  // });

  // //
  // // Initialize Listeners
  // // ====================
  // //
  // // All listener/reporter types are optional and either activated through the existence
  // // of configuration (i.e environment vars), CLI switches, or magellan.json config.
  // let listeners = [];

  // //
  // // Setup / Teardown
  // // ================
  // //
  // // This is merely a listener like any other reporter, but with a developer-friendly name.

  // if (runOpts.margs.argv.setup_teardown) {
  //   // NOTE: loadRelativeModule can throw an error here if the setup module doesn't exist
  //   // FIXME: handle this error nicely instead of printing an ugly stack trace
  //   listeners.push(runOpts.loadRelativeModule(runOpts.margs.argv.setup_teardown));
  // }

  // //
  // // Load reporters from magellan.json
  // // =================================
  // //
  // // Reporters that conform to the reporter API and inherit from src/reporter
  // // can be loaded in magellan.json through a reporters[] list. These can refer to
  // // either npm modules defined in package.json or to paths relative to the current
  // // working directory of the calling script or shell.
  // if (runOpts.margs.argv.reporters && _.isArray(runOpts.margs.argv.reporters)) {
  //   // NOTE: loadRelativeModule can throw an error here if any of the reporter modules don't exist
  //   // FIXME: handle this error nicely instead of printing an ugly stack trace
  //   listeners = listeners.concat(runOpts.margs.argv.reporters.map(runOpts.loadRelativeModule));
  // }

  // // optional_reporters are modules we want to load only if found. If not found, we
  // // still continue initializing Magellan and don't throw any errors or warnings
  // if (runOpts.margs.argv.optional_reporters && _.isArray(runOpts.margs.argv.optional_reporters)) {
  //   listeners = listeners.concat(
  //     runOpts.margs.argv.optional_reporters.map((reporterModule) => {
  //       return runOpts.loadRelativeModule(reporterModule, true);
  //     })
  //   );
  // }

  // //
  // // Serial Mode Reporter (enabled with --serial)
  // //
  // if (useSerialMode) {
  //   const StdoutReporter = runOpts.require("./reporters/stdout/reporter");
  //   listeners.push(new StdoutReporter());
  // }

  // //
  // // Find Tests, Start Worker Allocator
  // //
  // const tests = runOpts.getTests(runOpts.testFilters.detectFromCLI(runOpts.margs.argv));

  // if (_.isEmpty(tests)) {
  //   logger.log("Error: no tests found");
  //   defer.reject({ error: "No tests found" });
  //   return defer.promise;
  // }

  // const initializeListeners = () => {
  //   magellanGlobals.workerAmount = MAX_WORKERS;

  //   return new Promise((resolve, reject) => {
  //     async.each(listeners, (listener, done) => {
  //       listener.initialize(magellanGlobals)
  //         .then(() => done())
  //         .catch((err) => done(err));
  //     }, (err) => {
  //       if (err) {
  //         return reject(err);
  //       } else {
  //         return resolve();
  //       }
  //     });
  //   });
  // };

  // const startSuite = () => {
  //   return new Promise((resolve, reject) => {

  //     Promise
  //       .all(_.map(testExecutors, (executor) => executor.setupRunner()))
  //       .then(() => {
  //         workerAllocator.initialize((workerInitErr) => {
  //           if (workerInitErr) {
  //             logger.err("Could not start Magellan. Got error while initializing"
  //               + " worker allocator");
  //             return reject(workerInitErr);
  //           }

  //           const testRunner = new runOpts.TestRunner(tests, {
  //             debug,

  //             maxWorkers: MAX_WORKERS,

  //             maxTestAttempts: MAX_TEST_ATTEMPTS,

  //             profiles: targetProfiles,
  //             executors: testExecutors,

  //             listeners,

  //             strategies: runOpts.settings.strategies,

  //             serial: useSerialMode,

  //             allocator: workerAllocator,

  //             onSuccess: () => {
  //               /*eslint-disable max-nested-callbacks*/
  //               workerAllocator.teardown(() => {
  //                 Promise
  //                   .all(_.map(testExecutors, (executor) => executor.teardownRunner()))
  //                   .then(() => {
  //                     runOpts.processCleanup(() => {
  //                       return resolve();
  //                     });
  //                   })
  //                   .catch((err) => {
  //                     // we eat error here
  //                     logger.warn("executor teardownRunner error: " + err);
  //                     runOpts.processCleanup(() => {
  //                       return resolve();
  //                     });
  //                   });
  //               });
  //             },

  //             onFailure: (/*failedTests*/) => {
  //               /*eslint-disable max-nested-callbacks*/
  //               workerAllocator.teardown(() => {
  //                 Promise
  //                   .all(_.map(testExecutors, (executor) => executor.teardownRunner()))
  //                   .then(() => {
  //                     runOpts.processCleanup(() => {
  //                       // Failed tests are not a failure in Magellan itself,
  //                       // so we pass an empty error here so that we don't
  //                       // confuse the user. Magellan already outputs a failure
  //                       // report to the screen in the case of failed tests.
  //                       return reject(null);
  //                     });
  //                   })
  //                   .catch((err) => {
  //                     logger.warn("executor teardownRunner error: " + err);
  //                     // we eat error here
  //                     runOpts.processCleanup(() => {
  //                       return reject(null);
  //                     });
  //                   });
  //               });
  //             }
  //           });

  //           testRunner.start();
  //         });
  //       })
  //       .catch((err) => {
  //         return reject(err);
  //       });
  //   });
  // };

  // const enableExecutors = (_targetProfiles) => {
  //   // this is to allow magellan to double check with profile that
  //   // is retrieved by --profile or --profiles
  //   targetProfiles = _targetProfiles;

  //   return new Promise((resolve, reject) => {
  //     try {
  //       logger.log("Enabled executors:");
  //       _.forEach(
  //         _.uniq(_.map(_targetProfiles, (targetProfile) => targetProfile.executor)),
  //         (shortname) => {
  //           if (runOpts.settings.testExecutors[shortname]) {
  //             logger.log(`  ${runOpts.settings.testExecutors[shortname].name}`);
  //             runOpts.settings.testExecutors[shortname].validateConfig({ isEnabled: true });
  //           }
  //         });

  //       return resolve();
  //     } catch (err) {
  //       return reject(err);
  //     }
  //   });
  // };

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

  // return co(function* () {
  //   const targetProfile = yield runOpts.profiles.detectFromCLI(runOpts);

  //   yield enableExecutors(targetProfile);

  //   return targetProfile
  // }).catch((err) => {
  //   logger.warn(err);
  //   // defer.reject(err)
  //   throw err
  // });

  // return defer.promise;
};
