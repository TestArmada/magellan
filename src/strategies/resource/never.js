"use strict";

/* istanbul ignore next */
module.exports = {
  name: "testarmada-magellan-no-resource-strategy",
  description: "Magellan doesn't require a resource manager to schedule test run",
  failReason: "Magellan shouldn‘t depend on any resource manager to control test run",

  // resource format
  holdResourceForTest(profile) {
    // never use resource manager
    return Promise.resolve(profile);
  },

  // resource format
  holdResourcesForSuite(opts) {
    // never use resource manager
    return Promise.resolve(opts);
  },

  // resource format
  releaseResourceForTest(profile) {
    // never use resource manager
    return Promise.resolve(profile);
  },

  // resource format
  releaseResourcesForSuite(opts) {
    // never use resource manager
    return Promise.resolve(opts);
  }
};
