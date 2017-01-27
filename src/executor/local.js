"use strict";

module.exports = {
  name: "testarmada-magellan-local-executor",

  listBrowsers: (opts, callback) => {
    console.log("wtff");
    callback();
  },

  help: {
    "local_browser": {
      "visible": true,
      "type": "string",
      "example": "browsername",
      "description": "Run tests in chrome, firefox, etc (default: phantomjs)."
    },
    "local_browsers": {
      "visible": true,
      "type": "string",
      "example": "b1,b2,..",
      "description": "Run multiple browsers in parallel."
    },
    "local_list_browsers": {
      "visible": true,
      "type": "function",
      "description": "List the available browsers configured."
    }
  }
};
