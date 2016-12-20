"use strict";

var clc = require("cli-color");
var _ = require("lodash");
var path = require("path");
var sauceConnectLauncher = require("sauce-connect-launcher");

var settings = require("../settings");
var sauceSettingsFunc = require("./settings");
var analytics = require("../global_analytics");

var username;
var accessKey;

var connectFailures = 1;
/*eslint-disable no-magic-numbers*/
var MAX_CONNECT_RETRIES = process.env.SAUCE_CONNECT_NUM_RETRIES || 10;
var BAILED = false;

module.exports = {

  initialize: function (callback, opts) {
    var sauceSettings = sauceSettingsFunc(opts);
    username = sauceSettings.username;
    accessKey = sauceSettings.accessKey;

    var runOpts = _.assign({
      console: console,
      analytics: analytics,
      sauceConnectLauncher: sauceConnectLauncher
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
    }, function (err) {
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

  open: function (options, opts) {
    var runOpts = _.assign({
      console: console,
      settings: settings,
      sauceConnectLauncher: sauceConnectLauncher
    }, opts);

    var tunnelInfo = {};
    var tunnelId = options.tunnelId;
    var callback = options.callback;

    runOpts.console.info("Opening Sauce Tunnel ID: " + tunnelId + " for user " + username);

    var connect = function (/*runDiagnostics*/) {
      var logFilePath = path.resolve(settings.tempDir) + "/build-"
        + settings.buildId + "_sauceconnect_" + tunnelId + ".log";
      var sauceOptions = {
        username: username,
        accessKey: accessKey,
        tunnelIdentifier: tunnelId,
        readyFileId: tunnelId,
        verbose: settings.debug,
        verboseDebugging: settings.debug,
        logfile: logFilePath
      };

      if (runOpts.settings.fastFailRegexps) {
        sauceOptions.fastFailRegexps = runOpts.settings.fastFailRegexps;
      }

      var seleniumPort = options.seleniumPort;
      if (seleniumPort) {
        sauceOptions.port = seleniumPort;
      }

      if (runOpts.settings.debug) {
        runOpts.console.log("calling sauceConnectLauncher() w/ ", sauceOptions);
      }
      runOpts.sauceConnectLauncher(sauceOptions, function (err, sauceConnectProcess) {
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

  close: function (tunnelInfo, callback, opts) {
    var runOpts = _.assign({
      console: console
    }, opts);

    tunnelInfo.process.close(function () {
      runOpts.console.log("Closed Sauce Connect process");
      callback();
    });
  }
};
