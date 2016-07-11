"use strict";

// Sauce Settings
//
// Cobble together settings for sauce either from process.env or from a sauce configuration file

var argv = require("marge").argv;
var clc = require("cli-color");

/*eslint-disable no-magic-numbers*/
var config = {
  // required:
  username: process.env.SAUCE_USERNAME,
  accessKey: process.env.SAUCE_ACCESS_KEY,
  sauceConnectVersion: process.env.SAUCE_CONNECT_VERSION,

  // optional:
  sauceTunnelId: argv.sauce_tunnel_id,
  sharedSauceParentAccount: argv.shared_sauce_parent_account,
  tunnelTimeout: process.env.SAUCE_TUNNEL_CLOSE_TIMEOUT,
  useTunnels: !!argv.create_tunnels,
  maxTunnels: argv.num_tunnels || 1,

  locksServerLocation: argv.locks_server || process.env.LOCKS_SERVER,
  locksOutageTimeout: 1000 * 60 * 5,
  locksPollingInterval: 2500,
  locksRequestTimeout: 2500
};


// Remove trailing / in locks server location if it's present.
if (typeof config.locksServerLocation === "string" && config.locksServerLocation.length > 0) {
  if (config.locksServerLocation.charAt(config.locksServerLocation.length - 1) === "/") {
    config.locksServerLocation = config.locksServerLocation.substr(0,
      config.locksServerLocation.length - 1);
  }
}

var parameterWarnings = {
  username: {
    required: true,
    envKey: "SAUCE_USERNAME"
  },
  accessKey: {
    required: true,
    envKey: "SAUCE_ACCESS_KEY"
  },
  sauceConnectVersion: {
    required: false,
    envKey: "SAUCE_CONNECT_VERSION"
  }
};

// Validate configuration if we have --sauce
if (argv.sauce) {
  var valid = true;
  Object.keys(parameterWarnings).forEach(function (key) {
    var param = parameterWarnings[key];

    if (!config[key]) {
      if (param.required) {
        console.log(clc.redBright("Error! Sauce requires " + key + " to be set. Check if the"
          + " environment variable $" + param.envKey + " is defined."));
        valid = false;
      } else {
        console.log(clc.yellowBright("Warning! No " + key + " is set. This is set via the"
          + " environment variable $" + param.envKey + " . This isn't required, but can cause "
          + "problems with Sauce if not set"));
      }
    }
  });

  if (!valid) {
    throw new Error("Missing configuration for Saucelabs connection.");
  }

  if (argv.sauce_tunnel_id && argv.create_tunnels) {
    throw new Error("Only one Saucelabs tunnel arg is allowed, --sauce_tunnel_id " +
      "or --create_tunnels.");
  }

  if (argv.shared_sauce_parent_account && argv.create_tunnels) {
    throw new Error("--shared_sauce_parent_account only works with --sauce_tunnel_id.");
  }
}

if (argv.debug) {
  console.log("Sauce configuration: ", config);
}

console.log("Sauce configuration OK");

module.exports = config;
