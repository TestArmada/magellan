"use strict";

// let k = 1;

/* istanbul ignore next */
module.exports = {
  name: "testarmada-magellan-no-resource-strategy",
  description: "Magellan doesn't require a resource manager to schedule test run",
  failReason: "Magellan should not depend on any resource manager to control test run",

  // resource format
  decide(resources) {
    // never use resource manager
    // if (k < 3) {
    //   k++;
    //   return Promise.reject(new Error("fake error simulation"));
    // }
    return Promise.resolve(resources);
  }
};
