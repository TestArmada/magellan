"use strict";

/* istanbul ignore next */
module.exports = {
  name: "testarmada-magellan-fast-bail-strategy",
  description: "Magellan will bail immediately if one test has been failed",
  bailReason: "At least one test has been failed",

  // info format
  /*
   * {
   *  totalTests: [] // total tests
   *  passedTests: [] // successful tests
   *  failedTests: [] // failed tests
   * }
   */
  decide(info) {
    // never bail
    return info.failedTests.length > 0;
  }
};
