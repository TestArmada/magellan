const _ = require("lodash");
const logger = require("testarmada-logger");

const settings = {
  FAILURE_RATIO: 0.1,
  MIN_TEST_ATTEMPTS: 10,
  TEST_TIMEOUT: 8 * 60 * 1000
};

module.exports = {
  name: "testarmada-magellan-eaily-bail-strategy",
  description: "Magellan will bail if failure ratio exceeds a threshold within a given period",
  bailReason: () => `At least ${settings.FAILURE_RATIO * 100}% of tests have been failed after seeing at least`
    + ` ${settings.MIN_TEST_ATTEMPTS} tests run`,

  help: {
    "early_bail_threshold": {
      "visible": true,
      "type": "string",
      "example": "0.1",
      "description": "Ratio of tests that need to fail before we abandon the build"
    },
    "early_bail_min_attempts": {
      "visible": true,
      "type": "string",
      "example": "10",
      "description": "Minimum number of tests that need to run before we apply the bail strategy"
    },
  },

  setConfiguration(argv) {
    logger.prefix = "Early Bail Strategy";

    if (argv.early_bail_threshold) {
      settings.FAILURE_RATIO = argv.early_bail_threshold;
    }

    if (argv.early_bail_min_attempts) {
      settings.MIN_TEST_ATTEMPTS = argv.early_bail_min_attempts;
    }

    logger.debug(`bail config: ${JSON.stringify(settings)}`);
  },

  // info format
  /**
   * {
   *  totalTests: [] // total tests
   *  passedTests: [] // successful tests 
   *  failedTests: [] // failed tests
   * }
   */
  decide(info) {
    // Bail on a threshold. 
    // By default, if we've run at least ${settings.minTestAttempts} tests
    // and at least ${settings.failureRatio} of them have failed, we bail out early.
    // This allows for useful data-gathering for debugging or trend
    // analysis if we don't want to just bail on the first failed test.

    const sumAttempts = (memo, test) => memo + test.attempts;
    const totalAttempts = _.reduce(info.passedTests, sumAttempts, 0)
      + _.reduce(info.failedTests, sumAttempts, 0);

    // Failed attempts are not just the sum of all failed attempts but also
    // of successful tests that eventually passed (i.e. total attempts - 1).
    const sumExtraAttempts = (memo, test) => memo + Math.max(test.attempts - 1, 0);
    const failedAttempts = _.reduce(info.failedTests, sumAttempts, 0)
      + _.reduce(info.passedTests, sumExtraAttempts, 0);

    // Fail to total work ratio.
    const ratio = failedAttempts / totalAttempts;

    if (totalAttempts > settings.MIN_TEST_ATTEMPTS) {
      if (ratio > settings.FAILURE_RATIO) {
        return true;
      }
    }
    return false;
  }
};