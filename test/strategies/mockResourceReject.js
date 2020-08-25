'use strict';

/* istanbul ignore next */
module.exports = {
  name: 'fake-resource-reject-strategy',

  setConfiguration() { },

  // resource format
  releaseResourceForTest(profile) {
    // never use resource manager
    return Promise.reject(profile);
  },

  // resource format
  releaseResourcesForSuite(opts) {
    // never use resource manager
    return Promise.reject(opts);
  }
};
