#!/usr/bin/env node

"use strict";
/*eslint-disable no-magic-numbers*/
/*eslint-disable global-require*/
/*eslint-disable complexity*/

// Note: this script assumes you run this from the same directory as where
// the package.json that contains magellan resides. In addition
// configuration must either be explicitly specified relative to that directory
// or absolutely (or exist implicitly in the default location)

var yargs = require("yargs");
var path = require("path");
var _ = require("lodash");
var margs = require("marge");
var async = require("async");
var clc = require("cli-color");
var Q = require("q");

var analytics = require("./global_analytics");
var TestRunner = require("./test_runner");
var getTests = require("./get_tests");
var testFilters = require("./test_filter");
var WorkerAllocator = require("./worker_allocator");
var SauceWorkerAllocator = require("./sauce/worker_allocator");
var browserOptions = require("./detect_browsers");
var settings = require("./settings");
var sauceSettings = require("./sauce/settings")();
var MongoEmitter = require("./mongo_emitter");
var browsers = require("./sauce/browsers");
var loadRelativeModule = require("./util/load_relative_module");
var processCleanup = require("./util/process_cleanup");

module.exports = function (opts) {
  var defer = Q.defer();

  var runOpts = _.assign({
    require: require,
    console: console,
    analytics: analytics,
    MongoEmitter: MongoEmitter,
    settings: settings,
    sauceSettings: sauceSettings,
    browsers: browsers,
    yargs: yargs,
    margs: margs,
    SauceWorkerAllocator: SauceWorkerAllocator,
    WorkerAllocator: WorkerAllocator,
    TestRunner: TestRunner,
    process: process,
    getTests: getTests,
    testFilters: testFilters,
    browserOptions: browserOptions,
    processCleanup: processCleanup,
    path: path,
    loadRelativeModule: loadRelativeModule
  }, opts);

  var project = runOpts.require("../package.json");

  runOpts.console.log("Magellan " + project.version);

  var defaultConfigFilePath = "./magellan.json";
  var configFilePath = runOpts.yargs.argv.config;

  if (configFilePath) {
    runOpts.console.log("Will try to load configuration from " + configFilePath);
  } else {
    runOpts.console.log("Will try to load configuration from default of " + defaultConfigFilePath);
  }

  // NOTE: marge can throw an error here if --config points at a file that doesn't exist
  // FIXME: handle this error nicely instead of printing an ugly stack trace
  runOpts.margs.init(defaultConfigFilePath, configFilePath);

  var isSauce = runOpts.margs.argv.sauce ? true : false;
  var isNodeBased = runOpts.margs.argv.framework &&
    runOpts.margs.argv.framework.indexOf("mocha") > -1;

  var debug = runOpts.margs.argv.debug || false;
  var useSerialMode = runOpts.margs.argv.serial;
  var MAX_TEST_ATTEMPTS = parseInt(runOpts.margs.argv.max_test_attempts) || 3;
  var selectedBrowsers;
  var workerAllocator;
  var MAX_WORKERS;

  var magellanGlobals = {
    analytics: runOpts.analytics
  };

  // Initialize the mongo emitter
  runOpts.MongoEmitter.setup();

  runOpts.analytics.push("magellan-run");
  runOpts.analytics.push("magellan-busy", undefined, "idle");

  //
  // Initialize Framework Plugins
  // ============================
  //

  // We translate old names like "mocha" to the new module names for the
  // respective plugins that provide support for those frameworks. Officially,
  // moving forward, we should specify our framework (in magellan.json)
  var legacyFrameworkNameTranslations = {
    "rowdy-mocha": "testarmada-magellan-mocha-plugin",
    "vanilla-mocha": "testarmada-magellan-mocha-plugin",
    "nightwatch": "testarmada-magellan-nightwatch-plugin"
  };

  if (legacyFrameworkNameTranslations[runOpts.settings.framework]) {
    runOpts.settings.framework = legacyFrameworkNameTranslations[runOpts.settings.framework];
  }

  var frameworkLoadException;
  try {
    //
    // HELP WANTED: If someone knows how to do this more gracefully, please contribute!
    //
    var frameworkModulePath = "./node_modules/" + runOpts.settings.framework + "/index";
    runOpts.settings.testFramework = runOpts.require(runOpts.path.resolve(frameworkModulePath));
  } catch (e) {
    frameworkLoadException = e;
  }

  var frameworkInitializationException;
  try {
    var pkg = runOpts.require(runOpts.path.join(runOpts.process.cwd(), "package.json"));

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

  // Show help and exit if it's asked for
  if (runOpts.margs.argv.help) {
    var help = runOpts.require("./cli_help");
    help.help();
    defer.resolve(0);
    return defer.promise;
  }

  if (runOpts.margs.argv.list_browsers) {
    runOpts.browsers.initialize(true).then(function () {
      if (runOpts.margs.argv.device_additions) {
        runOpts.browsers.addDevicesFromFile(runOpts.margs.argv.device_additions);
      }
      runOpts.browsers.listBrowsers();
      defer.resolve();
    }).catch(function (err) {
      runOpts.console.log("Couldn't fetch runOpts.browsers. Error: ", err);
      runOpts.console.log(err.stack);
      defer.reject(err);
    });
    return defer.promise;
  }

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

    defer.reject({error: "Couldn't start Magellan"});
  }

  //
  // Initialize Listeners
  // ====================
  //
  // All listener/reporter types are optional and either activated through the existence
  // of configuration (i.e environment vars), CLI switches, or magellan.json config.
  var listeners = [];

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
      runOpts.margs.argv.optional_reporters.map(function (reporterModule) {
        return runOpts.loadRelativeModule(reporterModule, true);
      })
    );
  }

  //
  // Slack integration (enabled if settings exist)
  //
  var slackSettings = runOpts.require("./reporters/slack/settings");
  if (slackSettings.enabled) {
    var Slack = runOpts.require("./reporters/slack/slack");
    var slackReporter = new Slack(slackSettings);
    listeners.push(slackReporter);
  }

  //
  // Serial Mode Reporter (enabled with --serial)
  //
  if (useSerialMode) {
    var StdoutReporter = runOpts.require("./reporters/stdout/reporter");
    listeners.push(new StdoutReporter());
  }

  //
  // Screenshot Aggregation (enabled with --aggregate_screenshots)
  //
  if (runOpts.settings.aggregateScreenshots) {
    var ScreenshotAggregator = runOpts.require("./reporters/screenshot_aggregator/reporter");
    listeners.push(new ScreenshotAggregator());
  }

  //
  // Find Tests, Start Worker Allocator
  //
  var tests = runOpts.getTests(runOpts.testFilters.detectFromCLI(runOpts.margs.argv));

  if (_.isEmpty(tests)) {
    runOpts.console.log("Error: no tests found");
    defer.reject({error: "No tests found"});
    return defer.promise;
  }

  var initializeListeners = function () {
    var deferred = Q.defer();
    async.each(listeners, function (listener, done) {
      listener.initialize(magellanGlobals)
        .then(function () {
          done();
        }).catch(function (err) {
          done(err);
        });
    }, function (err) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
      }
    });
    return deferred.promise;
  };

  var startSuite = function () {
    var deferred = Q.defer();

    workerAllocator.initialize(function (err) {
      if (err) {
        runOpts.console.error(
          clc.redBright("Could not start Magellan. Got error while initializing"
          + " worker allocator"));
        deferred.reject(err);
        return defer.promise;
      }

      var testRunner = new runOpts.TestRunner(tests, {
        debug: debug,

        maxWorkers: MAX_WORKERS,

        maxTestAttempts: MAX_TEST_ATTEMPTS,

        browsers: selectedBrowsers,

        listeners: listeners,

        bailFast: runOpts.margs.argv.bail_fast ? true : false,
        bailOnThreshold: runOpts.margs.argv.bail_early ? true : false,

        serial: useSerialMode,

        allocator: workerAllocator,

        sauceSettings: isSauce ? runOpts.sauceSettings : undefined,

        onSuccess: function () {
          workerAllocator.teardown(function () {
            runOpts.processCleanup(function () {
              deferred.resolve();
            });
          });
        },

        onFailure: function (/*failedTests*/) {
          workerAllocator.teardown(function () {
            runOpts.processCleanup(function () {
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

  runOpts.browsers.initialize(isSauce)
    .then(function () {
      if (runOpts.margs.argv.device_additions) {
        runOpts.browsers.addDevicesFromFile(runOpts.margs.argv.device_additions);
      }
    })
    .then(runOpts.browserOptions.detectFromCLI.bind({}, runOpts.margs.argv, isSauce, isNodeBased))
    .then(function (_selectedBrowsers) {
      selectedBrowsers = _selectedBrowsers;
      if (!_selectedBrowsers) {
        // If this list comes back completely undefined, it's because we didn't
        // get anything back from either profile lookup or the saucelabs API, which
        // likely means we requested a browser that doesn't exist or no longer exists.
        runOpts.console.log(clc.redBright("\nError: No matching browsers have been found."
          + "\nTo see a list of sauce browsers, use the --list_browsers option.\n"));
        throw new Error("Invalid browser specified for Sauce support");
      } else if (_selectedBrowsers.length === 0) {
        runOpts.console.log(
          clc.redBright("\nError: To use --sauce mode, you need to specify a browser."
          + "\nTo see a list of sauce browsers, use the --list_browsers option.\n"));
        throw new Error("No browser specified for Sauce support");
      } else if (debug) {
        runOpts.console.log("Selected browsers: ");
        runOpts.console.log(_selectedBrowsers.map(function (b) {
          return [
            b.browserId,
            b.resolution ? b.resolution : "(any resolution)",
            b.orientation ? b.orientation : "(any orientation)"
          ].join(" ");
        }).join("\n"));
      }
    })
    .then(function () {
      //
      // Worker Count:
      // =============
      //
      // Non-sauce mode:
      //   Default to 8 workers if we're running phantomjs and *only* phantomjs,
      //                otherwise 3 if other browsers are involved
      //   Default to 1 worker in serial mode.
      //
      // Sauce mode:
      //   Default to 3 workers in parallel mode (default).
      //   Default to 1 worker in serial mode.
      //
      /*eslint-disable no-extra-parens*/
      if (isSauce) {
        MAX_WORKERS = useSerialMode ? 1 : (parseInt(runOpts.margs.argv.max_workers) || 3);
      } else {
        var DEFAULT_MAX_WORKERS = (selectedBrowsers.length === 1
          && selectedBrowsers[0] === "phantomjs") ? 8 : 3;
        MAX_WORKERS = useSerialMode ?
          1 : (parseInt(runOpts.margs.argv.max_workers) || DEFAULT_MAX_WORKERS);
      }

      if (isSauce) {
        workerAllocator = new runOpts.SauceWorkerAllocator(MAX_WORKERS);
      } else {
        workerAllocator = new runOpts.WorkerAllocator(MAX_WORKERS);
      }
    })
    .then(initializeListeners)
    // NOTE: if we don't end up in catch() below, magellan exits with status code 0 naturally
    .then(startSuite)
    .then(function () {
      defer.resolve();
    })
    .catch(function (err) {
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
      defer.reject({error: "Internal crash"});
    });

  return defer.promise;
};
