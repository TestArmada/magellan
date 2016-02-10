"use strict";

var util = require("util");
var BaseWorkerAllocator = require("../worker_allocator");
var _ = require("lodash");
var request = require("request");

var exec = require("child_process").exec;

var sauceSettings = require("./settings");
var settings = require("../settings");

var tunnel = require("./tunnel");
var BASE_SELENIUM_PORT_OFFSET = 56000;
var TUNNEL_PREFIX_RAND_MAX = 99999;
var STRNUM_BASE = 16;
var SECOND_MS = 1000;
var SECONDS_MINUTE = 60;

// Allow polling to stall for 5 minutes. This means we can have a locks server
// outage of 5 minutes or we can have the server return errors for that period
// of time before Magellan gives up and fails a test for infrastructure reasons.
var VM_POLLING_MAX_TIME = sauceSettings.locksOutageTimeout;

var VM_POLLING_INTERVAL = sauceSettings.locksPollingInterval;
var VM_REQUEST_TIMEOUT = sauceSettings.locksRequestTimeout;

function SauceWorkerAllocator(_MAX_WORKERS) {
  BaseWorkerAllocator.call(this, _MAX_WORKERS);

  this.tunnels = [];
  this.tunnelErrors = [];
  this.MAX_WORKERS = _MAX_WORKERS;
  this.maxTunnels = sauceSettings.maxTunnels;
  this.tunnelPrefix = Math.round(Math.random() * TUNNEL_PREFIX_RAND_MAX).toString(STRNUM_BASE);

  if (sauceSettings.locksServerLocation) {
    console.log("Using locks server at " + sauceSettings.locksServerLocation
      + " for VM traffic control.");
  }
}

util.inherits(SauceWorkerAllocator, BaseWorkerAllocator);

SauceWorkerAllocator.prototype.initialize = function (callback) {
  this.initializeWorkers(this.MAX_WORKERS);

  if (!sauceSettings.useTunnels) {
    return callback();
  } else {
    tunnel.initialize(function (initErr) {
      if (initErr) {
        return callback(initErr);
      } else {
        this.openTunnels(function (openErr) {
          if (openErr) {
            return callback(new Error("Cannot initialize worker allocator: " + openErr.toString()));
          } else {
            // NOTE: We wait until we know how many tunnels we actually got before
            // we assign tunnel ids to workers.
            this.assignTunnelsToWorkers(this.tunnels.length);
            return callback();
          }
        }.bind(this));
      }
    }.bind(this));
  }
};

SauceWorkerAllocator.prototype.release = function (worker) {
  var self = this;
  if (sauceSettings.locksServerLocation) {
    request({
      method: "POST",
      json: true,
      timeout: VM_REQUEST_TIMEOUT,
      body: {
        token: worker.token
      },
      url: sauceSettings.locksServerLocation + "/release"
    }, function () {
      // TODO: decide whether we care about an error at this stage. We're releasing
      // this worker whether the remote release is successful or not, since it will
      // eventually be timed out by the locks server.
      BaseWorkerAllocator.prototype.release.call(self, worker);
    });
  } else {
    BaseWorkerAllocator.prototype.release.call(self, worker);
  }
};

SauceWorkerAllocator.prototype.get = function (callback) {
  var self = this;

  //
  // http://0.0.0.0:3000/claim
  //
  // {"accepted":false,"message":"Claim rejected. No VMs available."}
  // {"accepted":true,"token":null,"message":"Claim accepted"}
  //
  if (sauceSettings.locksServerLocation) {
    var pollingStartTime = Date.now();

    // Poll the worker allocator until we have a known-good port, then run this test
    var poll = function () {
      if (settings.debug) {
        console.log("asking for VM..");
      }
      request.post({
        url: sauceSettings.locksServerLocation + "/claim",
        timeout: VM_REQUEST_TIMEOUT,
        form: {}
      }, function (error, response, body) {
        try {
          if (error) {
            throw new Error(error);
          }

          var result = JSON.parse(body);
          if (result) {
            if (result.accepted) {
              if (settings.debug) {
                console.log("VM claim accepted, token: " + result.token);
              }
              BaseWorkerAllocator.prototype.get.call(self, function (getWorkerError, worker) {
                if (worker) {
                  worker.token = result.token;
                }
                callback(getWorkerError, worker);
              });
            } else {
              if (settings.debug) {
                console.log("VM claim not accepted, waiting to try again ..");
              }
              // If we didn't get a worker, try again
              setTimeout(poll, VM_POLLING_INTERVAL);
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
          if (Date.now() - pollingStartTime > VM_POLLING_MAX_TIME) {
            // we've been polling for too long. Bail!
            return callback(new Error("Gave up trying to get "
                + "a saucelabs VM from locks server. " + e));
          } else {
            if (settings.debug) {
              console.log("Error from locks server, tolerating error and"
                + " waiting " + VM_POLLING_INTERVAL + "ms before trying again");
            }
            setTimeout(poll, VM_POLLING_INTERVAL);
          }
        }
      });
    };

    poll();
  } else {
    BaseWorkerAllocator.prototype.get.call(this, callback);
  }
};

SauceWorkerAllocator.prototype.assignTunnelsToWorkers = function (numOpenedTunnels) {
  var self = this;

  // Assign a tunnel id for each worker.
  this.workers.forEach(function (worker, i) {
    worker.tunnelId = self.getTunnelId(i % numOpenedTunnels);
    console.log("Assigning worker " + worker.index + " to tunnel " + worker.tunnelId);
  });
};

SauceWorkerAllocator.prototype.getTunnelId = function (tunnelIndex) {
  return sauceSettings.tunnelId + "_" + this.tunnelPrefix + "_" + tunnelIndex;
};

SauceWorkerAllocator.prototype.teardown = function (callback) {
  if (sauceSettings.useTunnels) {
    this.teardownTunnels(callback);
  } else {
    return callback();
  }
};

SauceWorkerAllocator.prototype.openTunnels = function (callback) {
  var self = this;

  var tunnelOpened = function (err, tunnelInfo) {

    if (err) {
      self.tunnelErrors.push(err);
    } else {
      self.tunnels.push(tunnelInfo);
    }

    if (self.tunnels.length === self.maxTunnels) {
      console.log("All tunnels open!  Continuing...");
      return callback();
    } else if (self.tunnels.length > 0
        && self.tunnels.length + self.tunnelErrors.length === self.maxTunnels) {
      // We've accumulated some tunnels and some errors. Continue with a limited number of workers?
      console.log("Opened only " + self.tunnels.length + " tunnels out of "
        + self.maxTunnels + " requested (due to errors).");
      console.log("Continuing with a reduced number of workers ("
        + self.tunnels.length + ").");
      return callback();
    } else if (self.tunnelErrors.length === self.maxTunnels) {
      // We've tried to open N tunnels but instead got N errors.
      return callback(new Error("\nCould not open any sauce tunnels (attempted to open "
        + self.maxTunnels + " total tunnels): \n" +
          self.tunnelErrors.map(function (tunnelErr) {
            return tunnelErr.toString();
          }).join("\n") + "\nPlease check that there are no "
            + "sauce-connect-launcher (sc) processes running."
        ));
    } else {
      if (err) {
        console.log("Failed to open a tunnel, number of failed tunnels: "
          + self.tunnelErrors.length);
      }
      console.log(self.tunnels.length + " of " + self.maxTunnels + " tunnels open.  Waiting...");
    }
  };

  var openTunnel = function (tunnelIndex) {

    var tunnelId = self.getTunnelId(tunnelIndex);
    console.log("Opening tunnel " + tunnelIndex + " of "
      + self.maxTunnels + " [id = " + tunnelId + "]");

    var options = {
      tunnelId: tunnelId,
      seleniumPort: BASE_SELENIUM_PORT_OFFSET + (tunnelIndex + 1),
      callback: tunnelOpened
    };

    tunnel.open(options);
  };

  _.times(this.maxTunnels, function (n) {
    // worker numbers are 1-indexed
    console.log("Waiting " + n + " sec to open tunnel #" + n);
    _.delay(function () {
      openTunnel(n);
    }, n * SECOND_MS);
  });

};

SauceWorkerAllocator.prototype.teardownTunnels = function (callback) {
  var self = this;

  var cleanupAndCallback = function () {
    self.cleanupTunnels(callback);
  };

  var tunnelsOriginallyOpen = this.tunnels.length;
  var tunnelsOpen = this.tunnels.length;
  var tunnelCloseTimeout = (sauceSettings.tunnelTimeout || SECONDS_MINUTE) * SECOND_MS;

  var closeTimer = setTimeout(function () {
    // sometimes, due to network flake, we never get acknowledgement that the tunnel
    // has been closed.  in such case, we don't want to hang the build indefinitely.
    console.log("Timeout reached waiting for tunnels to close... Continuing...");
    cleanupAndCallback();
  }, tunnelCloseTimeout);

  var tunnelClosed = function () {

    if (--tunnelsOpen === 0) {
      console.log("All tunnels closed!  Continuing...");
      clearTimeout(closeTimer);
      cleanupAndCallback();
    } else {
      console.log(tunnelsOpen + " of " + tunnelsOriginallyOpen
        + " tunnels still open... waiting...");
    }
  };

  _.each(self.tunnels, function (tunnelInfo) {
    tunnel.close(tunnelInfo, tunnelClosed);
  });
};

SauceWorkerAllocator.prototype.cleanupTunnels = function (callback) {
  // at this point, all sauce tunnel processes have already been sent the SIGTERM signal,
  // meaning they've already been "asked politely" to exit.  if any sauce tunnel processes
  // are still active at this point, we need to forcefully kill them so that we're not
  // leaving the build environment in a polluted state.

  // NOTE: this may not be Windows compatible
  var cmd = "pkill -9 -f " + sauceSettings.tunnelId;

  console.log("Cleaning up any remaining sauce connect processes with: " + cmd);

  exec(cmd, {}, function (error, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    callback();
  });
};

module.exports = SauceWorkerAllocator;
