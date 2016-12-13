/* eslint no-invalid-this: 0 */
"use strict";

var util = require("util");
var BaseWorkerAllocator = require("../worker_allocator");
var _ = require("lodash");
var request = require("request");

var sauceSettings = require("./settings")();
var settings = require("../settings");
var analytics = require("../global_analytics");
var guid = require("../util/guid");
var tunnel = require("./tunnel");

var BASE_SELENIUM_PORT_OFFSET = 56000;
var SECOND_MS = 1000;
var SECONDS_MINUTE = 60;

function SauceWorkerAllocator(_MAX_WORKERS, opts) {
  BaseWorkerAllocator.call(this, _MAX_WORKERS, opts);

  _.assign(this, {
    console: console,
    sauceSettings: sauceSettings,
    request: request,
    clearTimeout: clearTimeout,
    setTimeout: setTimeout,
    tunnel: tunnel,
    analytics: analytics,
    settings: settings,
    delay: _.delay
  }, opts);

  this.tunnels = [];
  this.tunnelErrors = [];
  this.MAX_WORKERS = _MAX_WORKERS;
  this.maxTunnels = this.sauceSettings.maxTunnels;
  this.tunnelPrefix = guid();

  if (this.sauceSettings.locksServerLocation) {
    this.console.log("Using locks server at " + this.sauceSettings.locksServerLocation
      + " for VM traffic control.");
  }
}

util.inherits(SauceWorkerAllocator, BaseWorkerAllocator);

SauceWorkerAllocator.prototype.initialize = function (callback) {
  this.initializeWorkers(this.MAX_WORKERS);

  if (!this.sauceSettings.useTunnels && !this.sauceSettings.sauceTunnelId) {
    return callback();
  } else if (this.sauceSettings.sauceTunnelId) {
    // Aoint test to a tunnel pool, no need to initialize tunnel
    // TODO: verify if sauce connect pool is avaiable and if at least one
    // tunnel in the pool is ready
    this.tunnels.push({ name: "fake sc process" });
    this.console.log("Connected to sauce tunnel pool with Tunnel ID",
      this.sauceSettings.sauceTunnelId);
    this.assignTunnelsToWorkers(this.tunnels.length);
    return callback();
  } else {
    this.tunnel.initialize(function (initErr) {
      if (initErr) {
        return callback(initErr);
      } else {
        this.analytics.push("sauce-open-tunnels");
        this.openTunnels(function (openErr) {
          if (openErr) {
            this.analytics.mark("sauce-open-tunnels", "failed");
            return callback(new Error("Cannot initialize worker allocator: " + openErr.toString()));
          } else {
            // NOTE: We wait until we know how many tunnels we actually got before
            // we assign tunnel ids to workers.
            this.analytics.mark("sauce-open-tunnels");
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
  if (this.sauceSettings.locksServerLocation) {
    this.request({
      method: "POST",
      json: true,
      timeout: this.sauceSettings.locksRequestTimeout,
      body: {
        token: worker.token
      },
      url: this.sauceSettings.locksServerLocation + "/release"
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
  if (this.sauceSettings.locksServerLocation) {
    var pollingStartTime = Date.now();

    // Poll the worker allocator until we have a known-good port, then run this test
    var poll = function () {
      if (self.settings.debug) {
        self.console.log("asking for VM..");
      }
      self.request.post({
        url: self.sauceSettings.locksServerLocation + "/claim",
        timeout: self.sauceSettings.locksRequestTimeout,
        form: {}
      }, function (error, response, body) {
        try {
          if (error) {
            throw new Error(error);
          }

          var result = JSON.parse(body);
          if (result) {
            if (result.accepted) {
              if (self.settings.debug) {
                self.console.log("VM claim accepted, token: " + result.token);
              }
              BaseWorkerAllocator.prototype.get.call(self, function (getWorkerError, worker) {
                if (worker) {
                  worker.token = result.token;
                }
                callback(getWorkerError, worker);
              });
            } else {
              if (self.settings.debug) {
                self.console.log("VM claim not accepted, waiting to try again ..");
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
          if (Date.now() - pollingStartTime > self.sauceSettings.locksOutageTimeout) {
            // we've been polling for too long. Bail!
            return callback(new Error("Gave up trying to get "
                + "a saucelabs VM from locks server. " + e));
          } else {
            if (self.settings.debug) {
              self.console.log("Error from locks server, tolerating error and"
                + " waiting " + self.sauceSettings.locksPollingInterval + "ms before trying again");
            }
            self.setTimeout(poll, self.sauceSettings.locksPollingInterval);
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
    self.console.log("Assigning worker " + worker.index + " to tunnel " + worker.tunnelId);
  });
};

SauceWorkerAllocator.prototype.getTunnelId = function (tunnelIndex) {
  if (this.sauceSettings.sauceTunnelId) {
    // if sauce tunnel id exists
    return this.sauceSettings.sauceTunnelId;
  } else {
    return this.tunnelPrefix + "_" + tunnelIndex;
  }
};

SauceWorkerAllocator.prototype.teardown = function (callback) {
  if (this.sauceSettings.useTunnels) {
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
      self.console.log("All tunnels open!  Continuing...");
      return callback();
    } else if (self.tunnels.length > 0
        && self.tunnels.length + self.tunnelErrors.length === self.maxTunnels) {
      // We've accumulated some tunnels and some errors. Continue with a limited number of workers?
      self.console.log("Opened only " + self.tunnels.length + " tunnels out of "
        + self.maxTunnels + " requested (due to errors).");
      self.console.log("Continuing with a reduced number of workers ("
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
        self.console.log("Failed to open a tunnel, number of failed tunnels: "
          + self.tunnelErrors.length);
      }
      self.console.log(
        self.tunnels.length + " of " + self.maxTunnels + " tunnels open.  Waiting..."
      );
    }
  };

  var openTunnel = function (tunnelIndex) {

    var tunnelId = self.getTunnelId(tunnelIndex);
    self.console.log("Opening tunnel " + tunnelIndex + " of "
      + self.maxTunnels + " [id = " + tunnelId + "]");

    var options = {
      tunnelId: tunnelId,
      seleniumPort: BASE_SELENIUM_PORT_OFFSET + (tunnelIndex + 1),
      callback: tunnelOpened
    };

    self.tunnel.open(options);
  };

  _.times(this.maxTunnels, function (n) {
    // worker numbers are 1-indexed
    self.console.log("Waiting " + n + " sec to open tunnel #" + n);
    self.delay(function () {
      openTunnel(n);
    }, n * SECOND_MS);
  });

};

SauceWorkerAllocator.prototype.teardownTunnels = function (callback) {
  var tunnelsOriginallyOpen = this.tunnels.length;
  var tunnelsOpen = this.tunnels.length;
  var tunnelCloseTimeout = (this.sauceSettings.tunnelTimeout || SECONDS_MINUTE) * SECOND_MS;

  var self = this;
  var closeTimer = this.setTimeout(function () {
    // NOTE: We *used to* forcefully clean up stuck tunnels in here, but instead,
    // we now leave the tunnel processes for process_cleanup to clean up.
    self.console.log("Timeout reached waiting for tunnels to close... Continuing...");
    return callback();
  }, tunnelCloseTimeout);

  var tunnelClosed = function () {

    if (--tunnelsOpen === 0) {
      self.console.log("All tunnels closed!  Continuing...");
      self.clearTimeout(closeTimer);
      return callback();
    } else {
      self.console.log(tunnelsOpen + " of " + tunnelsOriginallyOpen
        + " tunnels still open... waiting...");
    }
  };

  _.each(self.tunnels, function (tunnelInfo) {
    self.tunnel.close(tunnelInfo, tunnelClosed);
  });
};

module.exports = SauceWorkerAllocator;
