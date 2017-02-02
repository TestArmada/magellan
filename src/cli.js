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
const clc = require("cli-color");
const Q = require("q");

const analytics = require("./global_analytics");
const TestRunner = require("./test_runner");
const getTests = require("./get_tests");
const testFilters = require("./test_filter");
const WorkerAllocator = require("./worker_allocator");
// const SauceWorkerAllocator = require("./sauce/worker_allocator");
// const browserOptions = require("./detect_browsers");
const settings = require("./settings");
// const sauceSettings = require("./sauce/settings")();
const profiles = require("./profiles");
// const browsers = require("./sauce/browsers");
const loadRelativeModule = require("./util/load_relative_module");
const processCleanup = require("./util/process_cleanup");
const magellanArgs = require("./help").help;

module.exports = (opts) => {
  const defer = Q.defer();

  const runOpts = _.assign({
    require,
    console,
    analytics,
    settings,
    // sauceSettings,
    // browsers,
    yargs,
    margs,
    // SauceWorkerAllocator,
    WorkerAllocator,
    TestRunner,
    process,
    getTests,
    testFilters,
    // browserOptions,
    processCleanup,
    profiles,
    path,
    loadRelativeModule
  }, opts);

  const project = runOpts.require("../package.json");

  runOpts.console.log("Magellan " + project.version);

  const defaultConfigFilePath = "./magellan.json";
  const configFilePath = runOpts.yargs.argv.config;

  if (configFilePath) {
    runOpts.console.log("Will try to load configuration from " + configFilePath);
  } else {
    runOpts.console.log("Will try to load configuration from default of " + defaultConfigFilePath);
  }

  // NOTE: marge can throw an error here if --config points at a file that doesn't exist
  // FIXME: handle this error nicely instead of printing an ugly stack trace
  runOpts.margs.init(defaultConfigFilePath, configFilePath);

  const isSauce = runOpts.margs.argv.sauce ? true : false;
  const isNodeBased = runOpts.margs.argv.framework &&
    runOpts.margs.argv.framework.indexOf("mocha") > -1;

  const debug = runOpts.margs.argv.debug || false;
  const useSerialMode = runOpts.margs.argv.serial;
  const MAX_TEST_ATTEMPTS = parseInt(runOpts.margs.argv.max_test_attempts) || 3;
  // let selectedBrowsers;
  let targetProfiles;
  let testExecutors;
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

  // examine executor 
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
      runOpts.console.error(clc.redBright("Error: executors only accepts string and array"));
      runOpts.console.log(clc.yellowBright("Setting executor to \"local\" by default"));
    }
  } else {
    runOpts.console.warn(clc.yellowBright("Warning: no executor is passed in"));
    runOpts.console.log(clc.yellowBright("Setting executor to \"local\" by default"));
  }

  runOpts.settings.executors = formalExecutors;

  // load executor
  let executorLoadException;
  runOpts.settings.testExecutors = {};

  _.forEach(runOpts.settings.executors, (executor) => {
    try {
      const targetExecutor = runOpts.require(runOpts.path.resolve(executor));
      targetExecutor.validateConfig(runOpts);
      runOpts.settings.testExecutors[targetExecutor.shortName] = targetExecutor;
    } catch (e) {
      executorLoadException = e;
    }
  });

  testExecutors = runOpts.settings.testExecutors;

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
        let executorMethodName = _.camelCase(names.join(" "));

        if (_.has(v, executorMethodName)) {
          // method found in current executor
          v[executorMethodName](runOpts, () => {
            defer.resolve();
          });
        } else {
          runOpts.console.error(clc.redBright("Error: executor" + k + " doesn't has method " + executorMethodName + "."));
          defer.resolve();
        }
      }
    });
  });

  if (!runOpts.settings.testFramework ||
    frameworkLoadException ||
    frameworkInitializationException) {
    runOpts.console.error(clc.redBright("Error: Could not start Magellan."));
    if (frameworkLoadException) {
      runOpts.console.error(clc.redBright("Error: Could not load the testing framework plugin '"
        + runOpts.settings.framework + "'."
        + "\nCheck and make sure your package.json includes a module named '"
        + runOpts.settings.framework + "'."
        + "\nIf it does not, you can remedy this by typing:"
        + "\n\nnpm install --save " + runOpts.settings.framework));
      runOpts.console.log(frameworkLoadException);
    } else /* istanbul ignore else */ if (frameworkInitializationException) {
      runOpts.console.error(
        clc.redBright("Error: Could not initialize the testing framework plugin '"
          + runOpts.settings.framework + "'."
          + "\nThis plugin was found and loaded, but an error occurred during initialization:"));
      runOpts.console.log(frameworkInitializationException);
    }

    defer.reject({ error: "Couldn't start Magellan" });
  }

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
    runOpts.console.log("Error: no tests found");
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

    workerAllocator.initialize((err) => {
      if (err) {
        runOpts.console.error(
          clc.redBright("Could not start Magellan. Got error while initializing"
            + " worker allocator"));
        deferred.reject(err);
        return defer.promise;
      }

      const testRunner = new runOpts.TestRunner(tests, {
        debug,

        maxWorkers: MAX_WORKERS,

        maxTestAttempts: MAX_TEST_ATTEMPTS,

        profiles: targetProfiles,
        executors: testExecutors,
        // browsers: selectedBrowsers,

        listeners,

        bailFast: runOpts.margs.argv.bail_fast ? true : false,
        bailOnThreshold: runOpts.margs.argv.bail_early ? true : false,

        serial: useSerialMode,

        allocator: workerAllocator,

        // sauceSettings: isSauce ? runOpts.sauceSettings : undefined,

        onSuccess: () => {
          workerAllocator.teardown(() => {
            runOpts.processCleanup(() => {
              deferred.resolve();
            });
          });
        },

        onFailure: (/*failedTests*/) => {
          workerAllocator.teardown(() => {
            runOpts.processCleanup(() => {
              // Failed tests are not a failure in Magellan itself, so we pass an empty error
              // here so that we don't confuse the user. Magellan already outputs a failure
              // report to the screen in the case of failed tests.
              deferred.reject(null);
            });
          });
        }
      });

      testRunner.start();
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
      MAX_WORKERS = useSerialMode ? 1 : (parseInt(runOpts.margs.argv.max_workers) || 3);
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
        runOpts.console.error(clc.redBright("Error initializing Magellan"));
        runOpts.console.log(clc.redBright("\nError description:"));
        runOpts.console.error(err.toString());
        runOpts.console.log(clc.redBright("\nError stack trace:"));
        runOpts.console.log(err.stack);
      } else {
        // No err object means we didn't have an internal crash while setting up / tearing down
      }

      // Fail the test suite or fail because of an internal crash
      defer.reject({ error: "Internal crash" });
    });


  // runOpts.browsers.initialize(isSauce)
  //   .then(() => {
  //     if (runOpts.margs.argv.device_additions) {
  //       runOpts.browsers.addDevicesFromFile(runOpts.margs.argv.device_additions);
  //     }
  //   })
  //   .then(runOpts.browserOptions.detectFromCLI.bind({}, runOpts.margs.argv, isSauce, isNodeBased))
  //   .then((_selectedBrowsers) => {
  //     selectedBrowsers = _selectedBrowsers;
  //     if (!_selectedBrowsers) {
  //       // If this list comes back completely undefined, it's because we didn't
  //       // get anything back from either profile lookup or the saucelabs API, which
  //       // likely means we requested a browser that doesn't exist or no longer exists.
  //       runOpts.console.log(clc.redBright("\nError: No matching browsers have been found."
  //         + "\nTo see a list of sauce browsers, use the --list_browsers option.\n"));
  //       throw new Error("Invalid browser specified for Sauce support");
  //     } else if (_selectedBrowsers.length === 0) {
  //       runOpts.console.log(
  //         clc.redBright("\nError: To use --sauce mode, you need to specify a browser."
  //           + "\nTo see a list of sauce browsers, use the --list_browsers option.\n"));
  //       throw new Error("No browser specified for Sauce support");
  //     } else if (debug) {
  //       runOpts.console.log("Selected browsers: ");
  //       runOpts.console.log(_selectedBrowsers.map((b) => {
  //         return [
  //           b.browserId,
  //           b.resolution ? b.resolution : "(any resolution)",
  //           b.orientation ? b.orientation : "(any orientation)"
  //         ].join(" ");
  //       }).join("\n"));
  //     }
  //   })
  //   .then(() => {
  //     //
  //     // Worker Count:
  //     // =============
  //     //
  //     // Non-sauce mode:
  //     //   Default to 8 workers if we're running phantomjs and *only* phantomjs,
  //     //                otherwise 3 if other browsers are involved
  //     //   Default to 1 worker in serial mode.
  //     //
  //     // Sauce mode:
  //     //   Default to 3 workers in parallel mode (default).
  //     //   Default to 1 worker in serial mode.
  //     //
  //     /*eslint-disable no-extra-parens*/
  //     if (isSauce) {
  //       MAX_WORKERS = useSerialMode ? 1 : (parseInt(runOpts.margs.argv.max_workers) || 3);
  //     } else {
  //       const DEFAULT_MAX_WORKERS = (selectedBrowsers.length === 1
  //         && selectedBrowsers[0] === "phantomjs") ? 8 : 3;
  //       MAX_WORKERS = useSerialMode ?
  //         1 : (parseInt(runOpts.margs.argv.max_workers) || DEFAULT_MAX_WORKERS);
  //     }

  //     if (isSauce) {
  //       workerAllocator = new runOpts.SauceWorkerAllocator(MAX_WORKERS);
  //     } else {
  //       workerAllocator = new runOpts.WorkerAllocator(MAX_WORKERS);
  //     }
  //   })
  //   .then(initializeListeners)
  //   // NOTE: if we don't end up in catch() below, magellan exits with status code 0 naturally
  //   .then(startSuite)
  //   .then(() => {
  //     defer.resolve();
  //   })
  //   .catch((err) => {
  //     if (err) {
  //       runOpts.console.error(clc.redBright("Error initializing Magellan"));
  //       runOpts.console.log(clc.redBright("\nError description:"));
  //       runOpts.console.error(err.toString());
  //       runOpts.console.log(clc.redBright("\nError stack trace:"));
  //       runOpts.console.log(err.stack);
  //     } else {
  //       // No err object means we didn't have an internal crash while setting up / tearing down
  //     }

  //     // Fail the test suite or fail because of an internal crash
  //     defer.reject({ error: "Internal crash" });
  //   });

  return defer.promise;
};
