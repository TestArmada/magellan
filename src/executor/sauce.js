"use strict";

const fork = require("child_process").fork;
const listSauceCliBrowsers = require("guacamole/src/cli_list");
const SauceBrowsers = require("guacamole");
const clc = require("cli-color");
const _ = require("lodash");
const argv = require("marge").argv;

const config = {
  // required:
  username: null,
  accessKey: null,
  sauceConnectVersion: null,

  // optional:
  sauceTunnelId: null,
  sharedSauceParentAccount: null,
  tunnelTimeout: null,
  useTunnels: null,
  maxTunnels: null,
  fastFailRegexps: null,

  locksServerLocation: null,

  maxTunnels: 1,
  locksOutageTimeout: 1000 * 60 * 5,
  locksPollingInterval: 2500,
  locksRequestTimeout: 2500
};

module.exports = {
  name: "testarmada-magellan-sauce-executor",
  shortName: "sauce",

  forkAndExecute: (testRun, options) => {
    return fork(testRun.getCommand(), testRun.getArguments(), options);
  },

  validateConfig: (opts) => {
    const runOpts = _.assign({}, {
      argv,
      console,
      env: process.env
    }, opts);
    // required:
    config.username = runOpts.env.SAUCE_USERNAME;
    config.accessKey = runOpts.env.SAUCE_ACCESS_KEY;
    config.sauceConnectVersion = runOpts.env.SAUCE_CONNECT_VERSION;
    // optional:
    config.sauceTunnelId = runOpts.argv.sauce_tunnel_id;
    config.sharedSauceParentAccount = runOpts.argv.shared_sauce_parent_account;
    config.useTunnels = !!runOpts.argv.sauce_create_tunnels;
    config.tunnelTimeout = runOpts.env.SAUCE_TUNNEL_CLOSE_TIMEOUT;
    config.fastFailRegexps = runOpts.env.SAUCE_TUNNEL_FAST_FAIL_REGEXPS;

    config.locksServerLocation = runOpts.env.LOCKS_SERVER;

    // Remove trailing / in locks server location if it's present.
    if (typeof config.locksServerLocation === "string" && config.locksServerLocation.length > 0) {
      if (config.locksServerLocation.charAt(config.locksServerLocation.length - 1) === "/") {
        config.locksServerLocation = config.locksServerLocation.substr(0,
          config.locksServerLocation.length - 1);
      }
    }

    const parameterWarnings = {
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
      let valid = true;

      _.forEach(parameterWarnings, (v, k) => {
        if (!config[k]) {
          if (v.required) {
            runOpts.console.log(
              clc.redBright("Error! Sauce requires " + k + " to be set. Check if the"
                + " environment variable $" + v.envKey + " is defined."));
            valid = false;
          } else {
            runOpts.console.log(clc.yellowBright("Warning! No " + k + " is set. This is set via the"
              + " environment variable $" + v.envKey + " . This isn't required, but can cause "
              + "problems with Sauce if not set"));
          }
        }
      });

      if (!valid) {
        throw new Error("Missing configuration for Saucelabs connection.");
      }

      if (runOpts.argv.sauce_create_tunnels) {
        if (runOpts.argv.sauce_tunnel_id) {
          throw new Error("Only one Saucelabs tunnel arg is allowed, --sauce_tunnel_id " +
            "or --create_tunnels.");
        }

        if (runOpts.argv.shared_sauce_parent_account) {
          throw new Error("--shared_sauce_parent_account only works with --sauce_tunnel_id.");
        }
      }
    }

    if (runOpts.argv.debug) {
      runOpts.console.log("Sauce configuration: ", config);
    }

    runOpts.console.log("Sauce configuration OK");

    return config;
  },

  getProfiles: (opts) => {
    return SauceBrowsers
      .initialize()
      .then(() => {
        return new Promise((resolve, reject) => {
          if (opts.yargs.argv.sauce_browser) {
            let p = SauceBrowsers.get({
              id: opts.yargs.argv.sauce_browser
            });

            p.executor = "sauce";
            p.nightwatchEnv = "sauce";
            resolve(p);
          }
          else if (opts.yargs.argv.sauce_browsers) {
            const tempBrowsers = opts.yargs.argv.sauce_browsers.split(",");
            let returnBrowsers = [];

            _.forEach(tempBrowsers, (browser) => {
              let p = SauceBrowsers.get({
                id: browser
              })[0];

              p.executor = "sauce";
              p.nightwatchEnv = "sauce";

              returnBrowsers.push(p);
            });

            resolve(returnBrowsers);
          }
          else {
            resolve();
          }
        });
      });
  },

  getCapabilities: (profile) => {
    // profile key mapping
    // browser => id
    // resolution => screenResolution
    // orientation => deviceOrientation
    let p = {
      id: profile.browser
    };

    if (profile.resolution) {
      p.screenResolution = profile.resolution;
    }

    if (profile.orientation) {
      p.deviceOrientation = profile.orientation;
    }

    return SauceBrowsers
      .initialize()
      .then(() => {
        return new Promise((resolve, reject) => {
          try {
            let capabilities = SauceBrowsers.get(p)[0];
            // add executor info back to capabilities
            capabilities.executor = profile.executor;
            capabilities.nightwatchEnv = profile.executor;
            resolve(capabilities);
          } catch (e) {
            reject("Executor sauce cannot resolve profile "
              + profile);
          }
        });
      });

  },

  listBrowsers: (opts, callback) => {

    SauceBrowsers
      .initialize(true)
      .then(() => {
        return new Promise((resolve, reject) => {
          if (opts.margs.argv.device_additions) {
            SauceBrowsers.addNormalizedBrowsersFromFile(runOpts.margs.argv.device_additions);
          }
          resolve();
        });
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          listSauceCliBrowsers((browserTable) => {
            // convert table heading
            browserTable.options.head[1] = "Copy-Paste Command-Line Option";
            opts.console.log(browserTable.toString());
            opts.console.log("");
            resolve();
          });
        });
      })
      .then(() => {
        callback();
      })
      .catch((err) => {
        runOpts.console.log("Couldn't fetch sauce browsers. Error: ", err);
        runOpts.console.log(err.stack);
        callback();
      });
  },

  help: {
    "sauce_browser": {
      "visible": true,
      "type": "string",
      "example": "browsername",
      "description": "Run tests in chrome, firefox, etc (default: phantomjs)."
    },
    "sauce_browsers": {
      "visible": true,
      "type": "string",
      "example": "b1,b2,..",
      "description": "Run multiple browsers in parallel."
    },
    "sauce_list_browsers": {
      "visible": true,
      "type": "function",
      "description": "List the available browsers configured (Guacamole integrated)."
    },
    "sauce": {
      "visible": true,
      "type": "boolean",
      "description": "Run tests on SauceLabs cloud."
    },
    "sauce_create_tunnels": {
      "visible": true,
      "type": "boolean",
      "descriptions": "Create secure tunnels in sauce mode."
    },
    "sauce_tunnel_id": {
      "visible": true,
      "type": "string",
      "example": "testtunnel123123",
      "description": "Use an existing secure tunnel (exclusive with --sauce_create_tunnels)"
    },
    "shared_sauce_parent_account": {
      "visible": true,
      "type": "string",
      "example": "testsauceaccount",
      "description": "Specify parent account name if existing shared secure tunnel is in use (exclusive with --sauce_create_tunnels)"
    }
  }
};
