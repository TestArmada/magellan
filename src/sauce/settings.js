/* eslint complexity: 0 */
"use strict";

// Sauce Settings
//
// Cobble together settings for sauce either from process.env or from a sauce configuration file

var argv = require("marge").argv;
var clc = require("cli-color");

module.exports = function (mockSettings) {
  var _argv = argv;
  /* istanbul ignore next */
  if (mockSettings && mockSettings.argv) {
    _argv = mockSettings.argv;
  }
  var _console = console;
  /* istanbul ignore next */
  if (mockSettings && mockSettings.console) {
    _console = mockSettings.console;
  }
  var _env = process.env;
  /* istanbul ignore next */
  if (mockSettings && mockSettings.env) {
    _env = mockSettings.env;
  }

  /*eslint-disable no-magic-numbers*/
  var config = {
    // required:
    username: _env.SAUCE_USERNAME,
    accessKey: _env.SAUCE_ACCESS_KEY,
    sauceConnectVersion: _env.SAUCE_CONNECT_VERSION,

    // optional:
    sauceTunnelId: _argv.sauce_tunnel_id,
    sharedSauceParentAccount: _argv.shared_sauce_parent_account,
    tunnelTimeout: _env.SAUCE_TUNNEL_CLOSE_TIMEOUT,
    useTunnels: !!_argv.create_tunnels,
    maxTunnels: _argv.num_tunnels || 1,
    fastFailRegexps: _env.SAUCE_TUNNEL_FAST_FAIL_REGEXPS,

    locksServerLocation: _argv.locks_server || _env.LOCKS_SERVER,
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
  if (_argv.sauce) {
    var valid = true;
    Object.keys(parameterWarnings).forEach(function (key) {
      var param = parameterWarnings[key];

      if (!config[key]) {
        if (param.required) {
          _console.log(clc.redBright("Error! Sauce requires " + key + " to be set. Check if the"
            + " environment variable $" + param.envKey + " is defined."));
          valid = false;
        } else {
          _console.log(clc.yellowBright("Warning! No " + key + " is set. This is set via the"
            + " environment variable $" + param.envKey + " . This isn't required, but can cause "
            + "problems with Sauce if not set"));
        }
      }
    });

    if (!valid) {
      throw new Error("Missing configuration for Saucelabs connection.");
    }

    if (_argv.sauce_tunnel_id && _argv.create_tunnels) {
      throw new Error("Only one Saucelabs tunnel arg is allowed, --sauce_tunnel_id " +
        "or --create_tunnels.");
    }

    if (_argv.shared_sauce_parent_account && _argv.create_tunnels) {
      throw new Error("--shared_sauce_parent_account only works with --sauce_tunnel_id.");
    }
  }

  if (_argv.debug) {
    _console.log("Sauce configuration: ", config);
  }

  _console.log("Sauce configuration OK");

  return config;
};
