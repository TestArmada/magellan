"use strict";

const _ = require("lodash");
const logger = require("../logger");

const Factory = {
  /* eslint-disable global-require */
  // requires stragety on the fly
  create(argv) {
    const resourceRule = argv.strategy_resource ?
      argv.strategy_resource : "./resource/never";

    return require(resourceRule);
  }
};

class ResourceStrategy {
  constructor(argv) {

    try {
      _.assign(this, Factory.create(argv));
      // call configuration if set
      if (_.isFunction(this.setConfiguration)) {
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

  getFailReason() {
    // check if strategy has fail Reason defined
    if (!this.failReason) {
      logger.warn(`${this.name} doesn't have strategy fail reason.`
        + " You might want to add a failReason to it.");
      return "";
    }
    // prints out strategy's fail Reason
    return typeof this.failReason === "function" ? this.failReason() : this.failReason;
  }

  holdTestResource(resource) {
    if (_.isFunction(this.holdResourceForTest)) {
      return this.holdResourceForTest(resource);
    } else {
      // no holdTest is defined in strategy
      return Promise.resolve(resource);
    }

  }

  holdSuiteResources(resources) {
    if (_.isFunction(this.holdResourcesForSuite)) {
      return this.holdResourcesForSuite(resources);
    } else {
      // no holdSuite is defined in strategy
      return Promise.resolve(resources);
    }
  }

  releaseTestResource(resource) {
    if (_.isFunction(this.releaseResourceForTest)) {

      return this.releaseResourceForTest(resource)
        .then(() => Promise.resolve(resource))
        .catch((err) => {
          // we log warning but eat the error here
          logger.warn(`Error in releasing resource for test: ${err}.` +
            " This error doesn't impact test result.");
          return Promise.resolve(resource);
        });
    } else {
      // no holdTest is defined in strategy
      return Promise.resolve(resource);
    }

  }

  releaseSuiteResources(resources) {
    if (_.isFunction(this.releaseResourcesForSuite)) {
      return this.releaseResourcesForSuite(resources)
        .then(() => Promise.resolve(resources))
        .catch((err) => {
          // we log warning but eat the error here
          logger.warn(`Error in releasing resources for suite: ${err}.` +
            " This error doesn't impact suite result.");
          return Promise.resolve(resources);
        });
    } else {
      // no holdSuite is defined in strategy
      return Promise.resolve(resources);
    }
  }
}

module.exports = ResourceStrategy;
