"use strict";

module.exports = {
  name: "testarmada-magellan-sauce-executor",

  list_Browsers: () => {

  },

  help: {
    "sauce_browser": {
      "example": "browsername",
      "description": "Run tests in chrome, firefox, etc (default: phantomjs)."
    },
    "sauce_browsers": {
      "example": "b1,b2,..",
      "description": "Run multiple browsers in parallel."
    },
    "sauce_list_browsers": {
      "description": "List the available browsers configured (Guacamole integrated)."
    },
    "sauce": {
      "description": "Run tests on SauceLabs cloud."
    },
    "sauce_create_tunnels": {
      "descriptions": "Create secure tunnels in sauce mode."
    },
    "sauce_tunnel_id": {
      "example": "testtunnel123123",
      "description": "Use an existing secure tunnel (exclusive with --sauce_create_tunnels)"
    },
    "shared_sauce_parent_account": {
      "example": "testsauceaccount",
      "description": "Specify parent account name if existing shared secure tunnel is in use (exclusive with --sauce_create_tunnels)"
    }
  }
};
