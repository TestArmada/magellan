"use strict";

module.exports = {
  name: "testarmada-magellan-local-executor",

  list_Browsers: () => {

  },

  help: {
    "local_browser": {
      "example": "browsername",
      "description": "Run tests in chrome, firefox, etc (default: phantomjs)."
    },
    "local_browsers": {
      "example": "b1,b2,..",
      "description": "Run multiple browsers in parallel."
    },
    "local_list_browsers": {
      "description": "List the available browsers configured."
    }
  }
};
