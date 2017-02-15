"use strict";

const fork = require("child_process").fork;
const path = require("path");
const _ = require("lodash");
const logger = require("../logger");

module.exports = {
  name: "testarmada-magellan-local-executor",
  shortName: "local",

  setup: () => {
    return new Promise((resolve) => {
      resolve();
    });
  },

  teardown: () => {
    return new Promise((resolve) => {
      resolve();
    });
  },

  stage: (callback) => {
    callback();
  },

  wrapup: (worker, callback) => {
    callback();
  },

  execute: (testRun, options) => {
    return fork(testRun.getCommand(), testRun.getArguments(), options);
  },

  /*eslint-disable no-unused-vars*/
  validateConfig: (opts) => { },

  getConfig: () => {
    return null;
  },

  /*eslint-disable global-require*/
  getProfiles: (opts) => {
    const configPath = opts.settings.testFramework.settings.nightwatchConfigFilePath;
    const nightwatchConfig = require(path.resolve(configPath));
    const browsers = nightwatchConfig.test_settings;

    return new Promise((resolve, reject) => {
      if (opts.yargs.argv.local_browser) {
        const localBrowser = opts.yargs.argv.local_browser;
        if (browsers[localBrowser]) {
          const b = browsers[localBrowser];

          b.executor = "local";
          b.nightwatchEnv = localBrowser;
          b.id = localBrowser;

          resolve([b]);
        }
      } else if (opts.yargs.argv.local_browsers) {
        const tempBrowsers = opts.yargs.argv.local_browsers.split(",");
        const returnBrowsers = [];

        _.forEach(tempBrowsers, (browser) => {
          if (browsers[browser]) {
            const b = browsers[browser];

            b.executor = "local";
            b.nightwatchEnv = browser;
            b.id = browser;

            returnBrowsers.push(b);
          }
        });

        resolve(returnBrowsers);
      } else {
        resolve();
      }
    });
  },

  /*eslint-disable global-require*/
  getCapabilities: (profile, opts) => {
    const configPath = opts.settings.testFramework.settings.nightwatchConfigFilePath;
    const nightwatchConfig = require(path.resolve(configPath));
    const browsers = nightwatchConfig.test_settings;

    return new Promise((resolve, reject) => {
      if (browsers[profile]) {
        resolve();
      } else {
        reject("profile: " + profile + " isn't found");
      }
    });
  },

  /*eslint-disable global-require*/
  listBrowsers: (opts, callback) => {
    const configPath = opts.settings.testFramework.settings.nightwatchConfigFilePath;
    const nightwatchConfig = require(path.resolve(configPath));
    const browsers = nightwatchConfig.test_settings;

    _.forEach(browsers, (capabilities, browser) => {
      logger.log(browser, capabilities);
    });
    callback();
  },

  help: {
    "local_browser": {
      "visible": true,
      "type": "string",
      "example": "browsername",
      "description": "Run tests in chrome, firefox, etc (default: phantomjs)."
    },
    "local_browsers": {
      "visible": true,
      "type": "string",
      "example": "b1,b2,..",
      "description": "Run multiple browsers in parallel."
    },
    "local_list_browsers": {
      "visible": true,
      "type": "function",
      "description": "List the available browsers configured."
    }
  }
};
