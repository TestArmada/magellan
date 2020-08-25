"use strict";

/* istanbul ignore next */
module.exports = {
  name: "fake-bail-strategy",

  setConfiguration() { },

  decide() {
    // never bail
    return true;
  }
};
