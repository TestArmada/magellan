"use strict";

/* istanbul ignore next */
module.exports = {
  name: "testarmada-magellan-never-bail-strategy",
  description: "Magellan never bails, all tests will be executed at least once",
  bailReason: "Magellan should never bail, it should never reach here",

  // info format
  /*
   * {
   *  totalTests: [] // total tests
   *  passedTests: [] // successful tests
   *  failedTests: [] // failed tests
   * }
   */
  decide() {
    // never bail
    return false;
  }
};
