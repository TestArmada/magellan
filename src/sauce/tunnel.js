/* eslint no-console: 0 */
"use strict";

const clc = require("cli-color");
const _ = require("lodash");
const path = require("path");
const sauceConnectLauncher = require("sauce-connect-launcher");

const settings = require("../settings");
const sauceSettingsFunc = require("./settings");
const analytics = require("../global_analytics");

let username;
let accessKey;

let connectFailures = 1;
/*eslint-disable no-magic-numbers*/
const MAX_CONNECT_RETRIES = process.env.SAUCE_CONNECT_NUM_RETRIES || 10;
let BAILED = false;

module.exports = {
  initialize: (callback, opts) => {
    const sauceSettings = sauceSettingsFunc(opts);
    username = sauceSettings.username;
    accessKey = sauceSettings.accessKey;

    const runOpts = _.assign({
      console,
      analytics,
      sauceConnectLauncher
    }, opts);

    if (!username) {
      return callback("Sauce tunnel support is missing configuration: Sauce username.");
    }

    if (!accessKey) {
      return callback("Sauce tunnel support is missing configuration: Sauce access key.");
    }

    runOpts.analytics.push("sauce-connect-launcher-download");
    runOpts.sauceConnectLauncher.download({
      logger: console.log.bind(console)
    }, (err) => {
      if (err) {
        runOpts.analytics.mark("sauce-connect-launcher-download", "failed");
        runOpts.console.log(clc.redBright("Failed to download sauce connect binary:"));
        runOpts.console.log(clc.redBright(err));
        runOpts.console.log(clc.redBright("sauce-connect-launcher will attempt to re-download " +
          "next time it is run."));
      } else {
        runOpts.analytics.mark("sauce-connect-launcher-download");
      }
      callback(err);
    });
  },

  open: (options, opts) => {
    const runOpts = _.assign({
      console,
      settings,
      sauceConnectLauncher
    }, opts);

    const tunnelInfo = {};
    const tunnelId = options.tunnelId;
    const callback = options.callback;

    runOpts.console.info("Opening Sauce Tunnel ID: " + tunnelId + " for user " + username);

    const connect = (/*runDiagnostics*/) => {
      const logFilePath = path.resolve(settings.tempDir) + "/build-"
        + settings.buildId + "_sauceconnect_" + tunnelId + ".log";
      const sauceOptions = {
        username,
        accessKey,
        tunnelIdentifier: tunnelId,
        readyFileId: tunnelId,
        verbose: settings.debug,
        verboseDebugging: settings.debug,
        logfile: logFilePath
      };

      if (runOpts.settings.fastFailRegexps) {
        sauceOptions.fastFailRegexps = runOpts.settings.fastFailRegexps;
      }

      const seleniumPort = options.seleniumPort;
      if (seleniumPort) {
        sauceOptions.port = seleniumPort;
      }

      if (runOpts.settings.debug) {
        runOpts.console.log("calling sauceConnectLauncher() w/ ", sauceOptions);
      }
      runOpts.sauceConnectLauncher(sauceOptions, (err, sauceConnectProcess) => {
        if (err) {
          if (runOpts.settings.debug) {
            runOpts.console.log("Error from sauceConnectLauncher():");
          }
          runOpts.console.error(err.message);
          if (err.message && err.message.indexOf("Could not start Sauce Connect") > -1) {
            return callback(err.message);
          } else if (BAILED) {
            connectFailures++;
            // If some other parallel tunnel construction attempt has tripped the BAILED flag
            // Stop retrying and report back a failure.
            return callback(new Error("Bailed due to maximum number of tunnel retries."));
          } else {
            connectFailures++;

            if (connectFailures >= MAX_CONNECT_RETRIES) {
              // We've met or exceeded the number of max retries, stop trying to connect.
              // Make sure other attempts don't try to re-state this error.
              BAILED = true;
              return callback(new Error("Failed to create a secure sauce tunnel after "
                + connectFailures + " attempts."));
            } else {
              // Otherwise, keep retrying, and hope this is merely a blip and not an outage.
              runOpts.console.log(">>> Sauce Tunnel Connection Failed!  Retrying "
                + connectFailures + " of " + MAX_CONNECT_RETRIES + " attempts...");
              connect();
            }
          }
        } else {
          tunnelInfo.process = sauceConnectProcess;
          return callback(null, tunnelInfo);
        }
      });
    };

    connect();
  },

  close: (tunnelInfo, callback, opts) => {
    const runOpts = _.assign({
      console
    }, opts);

    tunnelInfo.process.close(() => {
      runOpts.console.log("Closed Sauce Connect process");
      callback();
    });
  }
};
