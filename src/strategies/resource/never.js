"use strict";

const _ = require("lodash");

/* istanbul ignore next */
module.exports = {
  name: "testarmada-magellan-no-resource-strategy",
  description: "Magellan doesn't require a resource manager to schedule test run",
  failReason: "Magellan shouldn‘t depend on any resource manager to control test run",

  // resource format
  proceedTest(profile) {
    // never use resource manager
    return Promise.resolve(profile);
  },

  // resource format
  proceedSuite(opts) {
    // never use resource manager
    return Promise.resolve();
  }
};
