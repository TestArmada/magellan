"use strict";

/* istanbul ignore next */
module.exports = {
  name: "testarmada-magellan-no-resource-strategy",
  description: "Magellan doesn't require a resource manager to schedule test run",
  failReason: "Magellan should not depend on any resource manager to control test run",

  // info format
  /*
   * {
   *  totalTests: [] // total tests
   *  passedTests: [] // successful tests
   *  failedTests: [] // failed tests
   * }
   */
  decide(resources) {
    // never use resource manager
    return new Promise((resolve, reject) => resolve(resources));
  }
};
