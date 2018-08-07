#!/usr/bin/env node

"use strict";
/*eslint-disable no-magic-numbers*/
/*eslint-disable global-require*/
/*eslint-disable complexity*/

// Note: this script assumes you run this from the same directory as where
// the package.json that contains magellan resides. In addition
// configuration must either be explicitly specified relative to that directory
// or absolutely (or exist implicitly in the default location)
const async = require("async");
const path = require("path");
const _ = require("lodash");
const clc = require("cli-color");

const analytics = require("./global_analytics");
const TestRunner = require("./test_runner");
const getTests = require("./get_tests");
const testFilters = require("./test_filter");
const WorkerAllocator = require("./worker_allocator");
const settings = require("./settings");
const profiles = require("./profiles");
const loadRelativeModule = require("./util/load_relative_module");
const processCleanup = require("./util/process_cleanup");
const constants = require("./constants");
const logger = require("./logger");

const BailStrategy = require("./strategies/bail");
const ResourceStrategy = require("./strategies/resource");

module.exports = {

  initialize() {

  },

  version() {
    const project = require("../package.json");
    logger.log(`Version:  ${clc.greenBright(project.version)}`);
    logger.log("Use --help to list out all command options");
  },

  help(opts) {
    // Show help
    logger.log("Printing magellan command line arguments:");
    require("./cli_help").help(opts);

    // exit process with exit code 0
    const e = new Error("end of help");
    e.code = constants.ERROR_CODE.HELP;

    return Promise.reject(e);
  },

  loadFramework(opts) {
    if (opts.mockFramework) {
      settings.framework = opts.mockFramework;
    }
    //
    // Initialize Framework Plugins
    // ============================

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

        if (settings.testFramework
          && settings.testFramework.getPluginOptions
          && _.isFunction(settings.testFramework.getPluginOptions)) {
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
          logger.err("Could not load the testing framework plugin:"
            + ` ${settings.framework}`);
          logger.err("Check and make sure your package.json includes module:"
            + ` ${settings.framework}`);
          logger.err(frameworkLoadException);
        } else /* istanbul ignore else */ if (frameworkInitializationException) {
          logger.err("Could not initialize the testing framework plugin:"
            + ` ${settings.framework}`);
          logger.err("This plugin was found and loaded, but an error"
            + " occurred during initialization:");
          logger.err(frameworkInitializationException);
        }

        return reject("Couldn't start Magellan");
      }

      logger.log("Loaded test framework from magellan.json: ");
      logger.log(`  ${clc.greenBright(settings.framework)}`);
      return resolve();
    });
  },

  loadExecutors(opts) {
    // Initialize Executor
    // ============================
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

      logger.log("Loaded test executors from magellan.json: ");

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
          // bail strategy can define its own test attempts
          settings.MAX_TEST_ATTEMPTS = settings.strategies.bail.MAX_TEST_ATTEMPTS;
        }

        logger.log("Enabled bail strategy: ");
        logger.log(`  ${clc.greenBright(settings.strategies.bail.name)}:`);
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
        logger.log(`  ${clc.greenBright(settings.strategies.resource.name)}:`);
        logger.log(`  -> ${settings.strategies.resource.getDescription()}`);
      } catch (err) {
        logger.err(`Cannot load resource strategy due to ${err}`);
        logger.err("Please npm install and configure in magellan.json");
        return reject("Couldn't start Magellan");
      }

      return resolve(settings.strategies);
    });
  },

  loadListeners(opts) {
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
    if (opts.argv.setup_teardown) {
      // NOTE: loadRelativeModule can throw an error here if the setup module doesn't exist
      // FIXME: handle this error nicely instead of printing an ugly stack trace
      listeners.push(loadRelativeModule(opts.argv.setup_teardown));
    }

    //
    // Load reporters from magellan.json
    // =================================
    //
    // Reporters that conform to the reporter API and inherit from src/reporter
    // can be loaded in magellan.json through a reporters[] list. These can refer to
    // either npm modules defined in package.json or to paths relative to the current
    // working directory of the calling script or shell.
    if (opts.argv.reporters
      && _.isArray(opts.argv.reporters)) {
      // NOTE: loadRelativeModule can throw an error here if any of the reporter modules don't exist
      // FIXME: handle this error nicely instead of printing an ugly stack trace
      listeners = listeners.concat(
        opts.argv.reporters.map((reporterModule) =>
          loadRelativeModule(reporterModule))
      );
    }

    // optional_reporters are modules we want to load only if found. If not found, we
    // still continue initializing Magellan and don't throw any errors or warnings
    if (opts.argv.optional_reporters
      && _.isArray(opts.argv.optional_reporters)) {
      listeners = listeners.concat(
        opts.argv.optional_reporters.map((reporterModule) =>
          loadRelativeModule(reporterModule, true))
      );
    }

    //
    // Serial Mode Reporter (enabled with --serial)
    //
    if (opts.argv.serial) {
      const SerialReporter = require("./reporters/stdout/reporter");
      listeners.push(new SerialReporter());
    }

    // intiialize listeners
    return new Promise((resolve, reject) => {
      async.each(listeners, (listener, done) => {
        listener.initialize({
          analytics,
          workerAmount: settings.MAX_WORKERS
        })
          .then(() => done())
          .catch((err) => done(err));
      }, (err) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(listeners);
        }
      });
    });
  },

  loadTests(opts) {
    //
    // Find Tests, Start Worker Allocator
    //
    logger.log("Searching for tests...");
    const tests = getTests(testFilters.detectFromCLI(opts.argv));

    const testAmount = tests.length > 0 ?
      clc.greenBright(tests.length) : clc.yellowBright(tests.length);

    logger.log(`Total tests found: ${testAmount}`);

    if (_.isEmpty(tests)) {
      return Promise.reject(new Error("No tests found, please make sure"
        + " test filter is set correctly,"
        + " or test path is configured correctly in nightwatch.json"));
    }
    // print out test amount and each test name
    _.map(tests, (t) => logger.log(`  -> ${t.filename}`));

    return Promise.resolve(tests);
  },


  detectProfiles(opts) {
    return profiles.detectFromCLI({
      argv: opts.argv,
      settings: opts.settings
    });
  },

  enableExecutors(opts) {
    // this is to allow magellan to double check profile that
    // is retrieved by --profile or --profiles
    const enabledExecutors = {};
    return new Promise((resolve, reject) => {

      try {
        _.forEach(
          _.uniq(_.map(opts.profiles, (profile) => profile.executor)),
          (shortname) => {
            if (settings.testExecutors[shortname]) {
              settings.testExecutors[shortname].validateConfig({ isEnabled: true });
              enabledExecutors[shortname] = settings.testExecutors[shortname];
            }
          });

        // for logging purpose
        if (!_.isEmpty(enabledExecutors)) {

          logger.log("Enabled executors:");
          _.forEach(enabledExecutors,
            (sn) => logger.log(`  ${clc.greenBright(sn.name)}`));
        }

        return resolve(enabledExecutors);
      } catch (err) {
        return reject(err);
      }
    });
  },

  startTestSuite(opts) {
    return new Promise((resolve, reject) => {

      const workerAllocator = new WorkerAllocator(settings.MAX_WORKERS);

      Promise
        .all(_.map(
          opts.executors,
          (executor) => executor.setupRunner())
        )
        .then(() => opts.strategies.resource.holdSuiteResources({
          workers: settings.workerAmount,
          profiles: opts.profiles,
          tests: opts.tests
        }))
        .then(
          () => workerAllocator.setup(),
          // if resource strategy decline the suite due to resource limit,
          // we fail test run
          (err) => reject(err)
        )
        .then(() =>
          new Promise((innerResolve, innerReject) =>
            new TestRunner(opts.tests, {
              profiles: opts.profiles,
              executors: opts.executors,
              listeners: opts.listeners,
              strategies: opts.strategies,
              allocator: workerAllocator,
              onFinish: (failedTests) => {

                if (failedTests.length > 0) {
                  const e = new Error("Test suite failed due to test failure");
                  e.code = constants.ERROR_CODE.TEST_FAILURE;
                  return innerReject(e);
                }

                return innerResolve();
              }
            }).run()
          )
        )
        // resource.releaseSuiteResources is guaranteed to execute
        .then(
          () => opts.strategies.resource.releaseSuiteResources({
            workers: settings.workerAmount,
            profiles: opts.profiles,
            tests: opts.tests
          }),
          (err) => opts.strategies.resource.releaseSuiteResources({
            workers: settings.workerAmount,
            profiles: opts.profiles,
            tests: opts.tests
          }).then(() => Promise.reject(err))
        )
        //  workerAllocator.teardown is guaranteed to execute
        .then(
          () => workerAllocator.teardown(),
          (err) => workerAllocator.teardown(err)
        )
        // executor.teardownRunner is guaranteed to execute
        .then(
          () => Promise
            .all(_.map(opts.executors,
              (executor) => executor.teardownRunner())),
          (err) => Promise
            .all(_.map(opts.executors,
              (executor) => executor.teardownRunner()))
            .then(() => Promise.reject(err))
            /*eslint no-unused-vars: 0 */
            .catch((otherErr) => Promise.reject(err))
        )
        //  processCleanup is guaranteed to execute
        .then(
          () => processCleanup(),
          (err) => processCleanup(err)
        )
        .then(() => resolve())
        .catch((err) => reject(err));
    });
  }
};
