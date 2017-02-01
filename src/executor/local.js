"use strict";

module.exports = {
  name: "testarmada-magellan-local-executor",
  shortName: "local",


  forkAndExecute: (testRun, options) => {
    return fork(testRun.getCommand(), testRun.getArguments(), options);
  },

  getCapabilities: (profile) => {
    return new Promise((resolve, reject) => {
      resolve();
    });
  },

  listBrowsers: (opts, callback) => {
    const nightwatchConfig = require(path.resolve(opts.settings.testFramework.settings.nightwatchConfigFilePath));

    const browsers = nightwatchConfig.test_settings;
    _.forEach(browsers, (capabilities, browser) => {
      console.log(browser, capabilities)
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
