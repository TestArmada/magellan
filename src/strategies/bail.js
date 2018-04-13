"use strict";

const _ = require("lodash");
const logger = require("../logger");

const Factory = {
  /* eslint-disable global-require */
  // requires stragety on the fly
  create(argv) {
    //
    // There is only one bail strategy allowed per magellan instance.
    // Bail strategy is configured via --strategy_bail.
    // If no --strategy_bail , enable ./strategies/bail_never by default
    const bailRule = argv.strategy_bail ?
      argv.strategy_bail : "./bail/never";

    return require(bailRule);
  }
};

class BailStrategy {
  constructor(argv) {

    this.hasBailed = false;

    try {
      _.assign(this, Factory.create(argv));
      // call configuration if set
      if (this.setConfiguration) {
        this.setConfiguration(argv);
      }
    } catch (err) {
      throw err;
    }
  }

  getDescription() {
    // check if strategy has description defined
    if (!this.description) {
      logger.warn(`${this.name} doesn't have strategy description. `
        + "You might want to add description to it.");
      return "";
    }
    // prints out strategy's description
    return this.description;
  }

  getBailReason() {
    // check if strategy has  bail Reason defined
    if (!this.bailReason) {
      logger.warn(`${this.name} doesn't have strategy bail reason.`
        + " You might want to add a bail reason to it.");
      return "";
    }
    // prints out strategy's bail Reason
    return typeof this.bailReason === "function" ? this.bailReason() : this.bailReason;
  }

  // info format
  /**
   * {
   *  totalTests: [] // total tests
   *  passedTests: [] // successful tests
   *  failedTests: [] // failed tests
   * }
   */

  shouldBail(info) {
    if (!this.hasBailed) {
      // suite isn't bailed yet, let strategy decide
      this.hasBailed = this.decide(info);
      if (this.hasBailed) {
        logger.warn("Test suite has bailed due to bail rule:");
        logger.warn(`  ${this.name}: ${this.getBailReason()}`);
      }
    }

    return this.hasBailed;
  }
}

module.exports = BailStrategy;
