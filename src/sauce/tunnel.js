"use strict";

var clc = require("cli-color");

var settings = require("../settings");
var sauceSettingsFunc = require("./settings");
var analytics = require("../global_analytics");

var path = require("path");
var sauceConnectLauncher = require("sauce-connect-launcher");

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

    var _console = console;
    /* istanbul ignore next */
    if (opts && opts.console) {
      _console = opts.console;
    }
    var _analytics = analytics;
    /* istanbul ignore next */
    if (opts && opts.analytics) {
      _analytics = opts.analytics;
    }
    var _scl = sauceConnectLauncher;
    /* istanbul ignore next */
    if (opts && opts.sauceConnectLauncher) {
      _scl = opts.sauceConnectLauncher;
    }

    if (!username) {
      return callback("Sauce tunnel support is missing configuration: Sauce username.");
    }

    if (!accessKey) {
      return callback("Sauce tunnel support is missing configuration: Sauce access key.");
    }

    _analytics.push("sauce-connect-launcher-download");
    _scl.download({
      logger: console.log.bind(console)
    }, function (err) {
      if (err) {
        _analytics.mark("sauce-connect-launcher-download", "failed");
        _console.log(clc.redBright("Failed to download sauce connect binary:"));
        _console.log(clc.redBright(err));
        _console.log(clc.redBright("sauce-connect-launcher will attempt to re-download " +
          "next time it is run."));
      } else {
        _analytics.mark("sauce-connect-launcher-download");
      }
      callback(err);
    });
  },

  open: function (options, opts) {
    var _console = console;
    /* istanbul ignore next */
    if (opts && opts.console) {
      _console = opts.console;
    }
    var _scl = sauceConnectLauncher;
    /* istanbul ignore next */
    if (opts && opts.sauceConnectLauncher) {
      _scl = opts.sauceConnectLauncher;
    }
    var _settings = settings;
    /* istanbul ignore next */
    if (opts && opts.settings) {
      _settings = opts.settings;
    }

    var tunnelInfo = {};
    var tunnelId = options.tunnelId;
    var callback = options.callback;

    _console.info("Opening Sauce Tunnel ID: " + tunnelId + " for user " + username);

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

      if (_settings.fastFailRegexps) {
        sauceOptions.fastFailRegexps = _settings.fastFailRegexps;
      }

      var seleniumPort = options.seleniumPort;
      if (seleniumPort) {
        sauceOptions.port = seleniumPort;
      }

      if (_settings.debug) {
        _console.log("calling sauceConnectLauncher() w/ ", sauceOptions);
      }
      _scl(sauceOptions, function (err, sauceConnectProcess) {
        if (err) {
          if (_settings.debug) {
            _console.log("Error from sauceConnectLauncher():");
          }
          _console.error(err.message);
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
              _console.log(">>> Sauce Tunnel Connection Failed!  Retrying "
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
    var _console = console;
    /* istanbul ignore next */
    if (opts && opts.console) {
      _console = opts.console;
    }
    tunnelInfo.process.close(function () {
      _console.log("Closed Sauce Connect process");
      callback();
    });
  }
};
