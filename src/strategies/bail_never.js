module.exports = {
  name: "testarmada-magellan-never-bail-strategy",
  description: "Never Bail: Magellan never bails. All tests will be executed at least once",
  bailReason: "Magellan should never bail, it should never reach here",

  // info format
  /**
   * {
   *  totalTests: [] // total tests
   *  passedTests: [] // successful tests 
   *  failedTests: [] // failed tests
   *  runtime: int // running time
   * }
   */
  decide(info) {
    // never bail
    return false;
  }
};