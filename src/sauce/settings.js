/* eslint complexity: 0, no-console: 0 */
"use strict";
var _ = require("lodash");

// Sauce Settings
//
// Cobble together settings for sauce either from process.env or from a sauce configuration file

var argv = require("marge").argv;
var clc = require("cli-color");

module.exports = function (opts) {
  var runOpts = _.assign({}, {
    argv: argv,
    console: console,
    env: process.env
  }, opts);

  /*eslint-disable no-magic-numbers*/
  var config = {
    // required:
    username: runOpts.env.SAUCE_USERNAME,
    accessKey: runOpts.env.SAUCE_ACCESS_KEY,
    sauceConnectVersion: runOpts.env.SAUCE_CONNECT_VERSION,

    // optional:
    sauceTunnelId: runOpts.argv.sauce_tunnel_id,
    sharedSauceParentAccount: runOpts.argv.shared_sauce_parent_account,
    tunnelTimeout: runOpts.env.SAUCE_TUNNEL_CLOSE_TIMEOUT,
    useTunnels: !!runOpts.argv.create_tunnels,
    maxTunnels: runOpts.argv.num_tunnels || 1,
    fastFailRegexps: runOpts.env.SAUCE_TUNNEL_FAST_FAIL_REGEXPS,

    locksServerLocation: runOpts.argv.locks_server || runOpts.env.LOCKS_SERVER,
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
  if (runOpts.argv.sauce) {
    var valid = true;
    Object.keys(parameterWarnings).forEach(function (key) {
      var param = parameterWarnings[key];

      if (!config[key]) {
        if (param.required) {
          runOpts.console.log(
            clc.redBright("Error! Sauce requires " + key + " to be set. Check if the"
              + " environment variable $" + param.envKey + " is defined."));
          valid = false;
        } else {
          runOpts.console.log(clc.yellowBright("Warning! No " + key + " is set. This is set via the"
            + " environment variable $" + param.envKey + " . This isn't required, but can cause "
            + "problems with Sauce if not set"));
        }
      }
    });

    if (!valid) {
      throw new Error("Missing configuration for Saucelabs connection.");
    }

    if (runOpts.argv.sauce_tunnel_id && runOpts.argv.create_tunnels) {
      throw new Error("Only one Saucelabs tunnel arg is allowed, --sauce_tunnel_id " +
        "or --create_tunnels.");
    }

    if (runOpts.argv.shared_sauce_parent_account && runOpts.argv.create_tunnels) {
      throw new Error("--shared_sauce_parent_account only works with --sauce_tunnel_id.");
    }
  }

  if (runOpts.argv.debug) {
    runOpts.console.log("Sauce configuration: ", config);
  }

  runOpts.console.log("Sauce configuration OK");

  return config;
};
