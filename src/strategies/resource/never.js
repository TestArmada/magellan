"use strict";

const _ = require("lodash");

let k = 1;

/* istanbul ignore next */
module.exports = {
  name: "testarmada-magellan-no-resource-strategy",
  description: "Magellan doesn't require a resource manager to schedule test run",
  failReason: "Magellan should not depend on any resource manager to control test run",

  // resource format
  proceedTest(profile) {
    // never use resource manager
    if (k < 3) {
      k++;
      return Promise.reject(new Error("No available Sauce VM."));
    }
    return Promise.resolve(profile);
  },

  // resource format
  proceedSuite(opts) {
    const multiplier = opts.tests.length;

    const reqBody = _.map(opts.profiles, (profile) => {
      return {
        gatekeeperinfo: {
          id: profile.id,
          quantity: multiplier
        }
      };
    });
    console.log(reqBody)
    // return Promise.resolve(resources);
    return Promise.reject(new Error("Available Sauce VM isn't enough to continue the test run"));
  }
};
