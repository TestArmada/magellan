"use strict";

const _ = require("lodash");
const logger = require("../logger");

class ResourceStrategy {
  constructor(strategy) {
    try {
      /* eslint-disable global-require */
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
      logger.warn(`${this.name} doesn't have strategy description. `
        + "You might want to add description to it.");
      return "";
    }
    // prints out strategy's description
    return this.description;
  }

  getFailReason() {
    // check if strategy has  bail Reason defined
    if (!this.failReason) {
      logger.warn(`${this.name} doesn't have strategy fail reason.`
        + " You might want to add a failReason to it.");
      return "";
    }
    // prints out strategy's bail Reason
    return typeof this.failReason === "function" ? this.failReason() : this.failReason;
  }

  proceed(resources) {
    return this.decide(resources);
  }
};

module.exports = ResourceStrategy;