var settings = require("../settings");
var path = require("path");
var sauceConnectLauncher = require('sauce-connect-launcher');

var connectFailures = 1;
var MAX_CONNECT_RETRIES = process.env.SAUCE_CONNECT_NUM_RETRIES || 10;
var BAILED = false;

module.exports = {

  initialize: function (callback) {
    sauceConnectLauncher.download({
      logger: console.log.bind(console),
    }, function (err) {
      if (err) {
        console.log("Failed to download sauce connect binary:", err);
        console.log("sauce-connect-launcher will attempt to re-download " +
          "next time it is run.");
      }
      callback(err);
    });
  },

  open: function (options) {

    var tunnelInfo = {},
      tunnelId = options.tunnelId,
      username = options.username,
      accessKey = options.accessKey,
      callback = options.callback;

    if (!username) {
      console.error("\nPlease set the SAUCE_USERNAME environment variable\n");
      process.exit(1);
    }

    if (!accessKey) {
      console.error("\nPlease set the SAUCE_ACCESS_KEY environment variable\n");
      process.exit(1);
    }

    console.info("Opening Sauce Tunnel ID: " + tunnelId + " for user " + username);

    var connect = function (runDiagnostics) {
      var sauceOptions = {
        username: username,
        accessKey: accessKey,
        tunnelIdentifier: tunnelId,
        readyFileId: tunnelId,
        verbose: settings.debug,
        verboseDebugging: settings.debug,
        logfile: path.resolve(settings.tempDir) + "/build-" + settings.buildId + "_sauceconnect_" + tunnelId + ".log"
      };

      var seleniumPort = options.seleniumPort;
      if (seleniumPort) {
        sauceOptions.port = seleniumPort;
      }

      if (settings.debug) {
        console.log("calling sauceConnectLauncher() w/ ", sauceOptions);
      }
      sauceConnectLauncher(sauceOptions, function (err, sauceConnectProcess) {
        if (err) {
          if (settings.debug) {
            console.log("Error from sauceConnectLauncher():");
          }
          console.error(err.message);
          if (err.message && err.message.indexOf("Could not start Sauce Connect") > -1) {
            callback(err.message);
          } else if (BAILED) {
            connectFailures++;
            // If some other parallel tunnel construction attempt has tripped the BAILED flag
            // Stop retrying and report back a failure.
            callback(new Error("Bailed due to maximum number of tunnel retries."));
          } else {
            connectFailures++;

            // NOTE: diagnostic mode hangs and loops forever, so disable it for now until
            // we can figure out how to kill it after a timeout.
            // if (connectFailures === MAX_CONNECT_RETRIES - 1) {
            //   // If we're attempting a tunnel connection for the very last time, run in
            //   // doctor mode and get some diagnostic information in the output.
            //   console.log(">>> Sauce Tunnel Connection Failed "
            //     + MAX_CONNECT_RETRIES + " of " + MAX_CONNECT_RETRIES + " attempts.  Gathering diagnostic info (final attempt):");
            //   connect(/*runDiagnostics*/true);
            // } else

            if (connectFailures >= MAX_CONNECT_RETRIES) {
              // We've met or exceeded the number of max retries, stop trying to connect.
              // Make sure other attempts don't try to re-state this error.
              BAILED = true;
              callback(new Error("Failed to create a secure sauce tunnel after " + connectFailures + " attempts."));
            } else {
              // Otherwise, keep retrying, and hope this is merely a blip and not an outage.
              console.log(">>> Sauce Tunnel Connection Failed!  Retrying "
                + connectFailures + " of " + MAX_CONNECT_RETRIES + " attempts...");
              connect();
            }
          }
        } else {
          tunnelInfo.process = sauceConnectProcess;
          callback(null, tunnelInfo);
        }
      });
    };

    connect();
  },

  close: function (tunnelInfo, callback) {
    tunnelInfo.process.close(function () {
      console.log("Closed Sauce Connect process");
      callback();
    });
  }
};
