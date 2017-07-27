const _ = require("lodash");
const logger = require("./logger");

class BailStrategy {
  constructor(strategy) {
    this.hasBailed = false;

    try {
      // requires stragety on the fly
      _.assign(this, require(strategy));
    } catch (e) {
      throw new Error(e);
    }
  }

  configure(argv) {
    // set configuration if the strategy requires 
    // input from command line 
    if (this.setConfiguration) {
      this.setConfiguration(argv);
    }
  }

  getDescription() {
    // check if strategy has description defined
    if (!this.description) {
      logger.warn(`${this.name} doesn't have strategy description. You might want to add description to it.`);
      return "";
    }
    // prints out strategy's description
    return this.description;
  }

  getBailReason() {
    // check if strategy has  bail Reason defined
    if (!this.bailReason) {
      logger.warn(`${this.name} doesn't have strategy bail reason. You might want to add a bail reason to it.`);
      return "";
    }
    // prints out strategy's bail Reason
    return this.bailReason;
  }

  // info format
  /**
   * {
   *  totalTests: [] // total tests
   *  passedTests: [] // successful tests 
   *  failedTests: [] // failed tests
   *  runtime: int // running time
   * }
   */

  shouldBail(info) {
    if (!this.hasBailed) {
      // suite isn't bailed yet, let strategy decide
      this.hasBailed = this.decide(info);
      if (this.hasBailed) {
        logger.warn(`Test suite has bailed due to bail rule:`);
        logger.warn(`  ${this.name}: ${this.getBailReason()}`);
      }
    }

    return this.hasBailed;
  }
};

module.exports = BailStrategy;
