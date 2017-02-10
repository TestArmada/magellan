"use strict";

const fork = require("child_process").fork;
const listSauceCliBrowsers = require("guacamole/src/cli_list");
const SauceBrowsers = require("guacamole");
const clc = require("cli-color");
const _ = require("lodash");
const request = require("request");
const argv = require("marge").argv;
const sauceConnectLauncher = require("sauce-connect-launcher");
const path = require("path");

const guid = require("../util/guid");
const settings = require("../settings");

let connectFailures = 1;
/*eslint-disable no-magic-numbers*/
const MAX_CONNECT_RETRIES = process.env.SAUCE_CONNECT_NUM_RETRIES || 10;
const BASE_SELENIUM_PORT_OFFSET = 56000;
let BAILED = false;

class Locks {
  constructor(options) {
    this.options = _.assign({}, options);

    if (this.options.locksServerLocation) {
      console.log("Using locks server at " + this.options.locksServerLocation
        + " for VM traffic control.");
    }
  }

  acquire(callback) {
    if (this.options.locksServerLocation) {
      // this will block untill lock server returns a valid vm token
      //
      // http://0.0.0.0:3000/claim
      //
      // {"accepted":false,"message":"Claim rejected. No VMs available."}
      // {"accepted":true,"token":null,"message":"Claim accepted"}
      //
      const pollingStartTime = Date.now();

      // Poll the worker allocator until we have a known-good port, then run this test
      const poll = () => {
        if (settings.debug) {
          console.log("asking for VM..");
        }
        request.post({
          url: this.options.locksServerLocation + "/claim",
          timeout: this.options.locksRequestTimeout,
          form: {}
        }, (error, response, body) => {
          try {
            if (error) {
              throw new Error(error);
            }

            const result = JSON.parse(body);
            if (result) {
              if (result.accepted) {
                if (settings.debug) {
                  console.log("VM claim accepted, token: " + result.token);
                }
                // super.get.call(this, (getWorkerError, worker) => {
                //   if (worker) {
                //     worker.token = result.token;
                //   }
                //   callback(getWorkerError, worker);
                // });
                callback(null, { token: result.token });
              } else {
                if (settings.debug) {
                  console.log("VM claim not accepted, waiting to try again ..");
                }
                // If we didn't get a worker, try again
                throw new Error("Request not accepted");
              }
            } else {
              throw new Error("Result from locks server is invalid or empty: '" + result + "'");
            }
          } catch (e) {
            // NOTE: There are several errors that can happen in the above code:
            //
            // 1. Parsing - we got a response from locks, but it's malformed
            // 2. Interpretation - we could parse a result, but it's empty or weird
            // 3. Connection - we attempted to connect, but timed out, 404'd, etc.
            //
            // All of the above errors end up here so that we can indiscriminately
            // choose to tolerate all types of errors until we've waited too long.
            // This allows for the locks server to be in a bad state (whether due
            // to restart, failure, network outage, or whatever) for some amount of
            // time before we panic and start failing tests due to an outage.
            if (Date.now() - pollingStartTime > this.options.locksOutageTimeout) {
              // we've been polling for too long. Bail!
              return callback(new Error("Gave up trying to get "
                + "a saucelabs VM from locks server. " + e));
            } else {
              if (settings.debug) {
                console.log("Error from locks server, tolerating error and" +
                  " waiting " + this.options.locksPollingInterval +
                  "ms before trying again");
              }
              setTimeout(poll, this.options.locksPollingInterval);
            }
          }
        });
      };

      poll();
    } else {
      callback();
    }
  }

  release(token, callback) {
    if (this.options.locksServerLocation) {
      request({
        method: "POST",
        json: true,
        timeout: this.options.locksRequestTimeout,
        body: {
          token: token
        },
        url: this.options.locksServerLocation + "/release"
      }, () => {
        // TODO: decide whether we care about an error at this stage. We're releasing
        // this worker whether the remote release is successful or not, since it will
        // eventually be timed out by the locks server.
        callback();
      });
    } else {
      callback();
    }
  }
};

class Tunnel {
  constructor(options) {
    this.options = _.assign({}, options);
  }

  initialize() {
    return new Promise((resolve, reject) => {
      if (!this.options.username) {
        return reject("Sauce tunnel support is missing configuration: Sauce username.");
      }

      if (!this.options.accessKey) {
        return reject("Sauce tunnel support is missing configuration: Sauce access key.");
      }

      // runOpts.analytics.push("sauce-connect-launcher-download");
      sauceConnectLauncher.download({
        logger: console.log.bind(console)
      }, (err) => {
        if (err) {
          // runOpts.analytics.mark("sauce-connect-launcher-download", "failed");
          console.log(clc.redBright("Failed to download sauce connect binary:"));
          console.log(clc.redBright(err));
          console.log(clc.redBright("sauce-connect-launcher will attempt to re-download " +
            "next time it is run."));
          reject(err);
        } else {
          // runOpts.analytics.mark("sauce-connect-launcher-download");
          resolve();
        }
      });
    });

  }

  open() {
    this.tunnelInfo = null;
    const tunnelId = this.options.sauceTunnelId;
    const username = this.options.username;
    const accessKey = this.options.accessKey;

    console.info("Opening sauce tunnel [" + tunnelId + "] for user " + username);

    const connect = (/*runDiagnostics*/) => {
      return new Promise((resolve, reject) => {
        const logFilePath = path.resolve(settings.tempDir) + "/build-"
          + settings.buildId + "_sauceconnect_" + tunnelId + ".log";
        const sauceOptions = {
          username,
          accessKey,
          tunnelIdentifier: tunnelId,
          readyFileId: tunnelId,
          verbose: settings.debug,
          verboseDebugging: settings.debug,
          logfile: logFilePath,
          port: BASE_SELENIUM_PORT_OFFSET
        };

        if (this.options.fastFailRegexps) {
          sauceOptions.fastFailRegexps = this.options.fastFailRegexpss;
        }

        if (settings.debug) {
          console.log("calling sauceConnectLauncher() w/ ", sauceOptions);
        }

        sauceConnectLauncher(sauceOptions, (err, sauceConnectProcess) => {
          if (err) {
            if (settings.debug) {
              console.log("Error from sauceConnectLauncher():");
            }
            console.error(err.message);
            if (err.message && err.message.indexOf("Could not start Sauce Connect") > -1) {
              return reject(err.message);
            } else if (BAILED) {
              connectFailures++;
              // If some other parallel tunnel construction attempt has tripped the BAILED flag
              // Stop retrying and report back a failure.
              return reject(new Error("Bailed due to maximum number of tunnel retries."));
            } else {
              connectFailures++;

              if (connectFailures >= MAX_CONNECT_RETRIES) {
                // We've met or exceeded the number of max retries, stop trying to connect.
                // Make sure other attempts don't try to re-state this error.
                BAILED = true;
                return reject(new Error("Failed to create a secure sauce tunnel after "
                  + connectFailures + " attempts."));
              } else {
                // Otherwise, keep retrying, and hope this is merely a blip and not an outage.
                console.log(">>> Sauce Tunnel Connection Failed!  Retrying "
                  + connectFailures + " of " + MAX_CONNECT_RETRIES + " attempts...");
                return connect();
              }
            }
          } else {
            this.tunnelInfo = { process: sauceConnectProcess };
            return resolve();
          }
        });
      });
    };

    return connect();
  }

  close() {
    return new Promise((resolve, reject) => {
      const self = this;
      if (this.tunnelInfo) {
        console.log("Closing sauce tunnel [" + this.options.sauceTunnelId + "]");
        this.tunnelInfo.process.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });

  }
};

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

let tunnel = null;
let locks = null;

module.exports = {
  name: "testarmada-magellan-sauce-executor",
  shortName: "sauce",

  setup: () => {
    locks = new Locks(config);

    if (config.useTunnels) {
      // create new tunnel if needed
      tunnel = new Tunnel(config);

      return tunnel
        .initialize()
        .then(() => {
          return tunnel
            .open();
        })
        .then(() => {
          console.log("Sauce tunnel is opened!  Continuing...");
          console.log("Assigned tunnel [" + config.sauceTunnelId + "] to all workers");
        })
        .catch((err) => {
          return new Promise((resolve, reject) => {
            reject(err);
          });
        });
    } else {
      return new Promise((resolve, reject) => {
        let tunnelAnnouncement = config.sauceTunnelId;
        if (config.sharedSauceParentAccount) {
          tunnelAnnouncement = config.sharedSauceParentAccount + "/" + tunnelAnnouncement;
        }
        console.log("Connected to sauce tunnel pool with tunnel [" + tunnelAnnouncement + "]");
        return resolve();
      });
    }
  },

  teardown: () => {
    // close tunnel if needed
    if (tunnel && config.useTunnels) {
      return tunnel
        .close()
        .then(() => {
          console.log("Sauce tunnel is closed!  Continuing...");
        })
    } else {
      return new Promise((resolve, reject) => {
        resolve("=====> teardown sauce");
      });
    }
  },

  stage: (callback) => {
    locks.acquire(callback);
  },

  destory: (info, callback) => {
    locks.release(info, callback);
  },

  execute: (testRun, options) => {
    return fork(testRun.getCommand(), testRun.getArguments(), options);
  },

  getConfig: () => {
    return config;
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

      // after verification we want to add sauce_tunnel_id if it's null till now

      if (!config.sauceTunnelId) {
        // auto generate tunnel id
        config.sauceTunnelId = guid();
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
            let p = {
              desiredCapabilities: SauceBrowsers.get({
                id: opts.yargs.argv.sauce_browser
              })[0],
              executor: "sauce",
              nightwatchEnv: "sauce"
            };

            resolve(p);
          }
          else if (opts.yargs.argv.sauce_browsers) {
            const tempBrowsers = opts.yargs.argv.sauce_browsers.split(",");
            let returnBrowsers = [];

            _.forEach(tempBrowsers, (browser) => {
              let p = {
                desiredCapabilities: SauceBrowsers.get({
                  id: browser
                })[0],
                executor: "sauce",
                nightwatchEnv: "sauce"
              };

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
            let desiredCapabilities = SauceBrowsers.get(p)[0];
            // add executor info back to capabilities
            let p = {
              desiredCapabilities: desiredCapabilities,
              executor: profile.executor,
              nightwatchEnv: profile.executor
            };

            resolve(p);
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
