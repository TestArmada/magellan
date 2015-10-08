var util = require("util")
var BaseWorkerAllocator = require("../worker_allocator");
var _ = require("lodash");
var request = require("request");

var exec = require("child_process").exec;

var sauceSettings = require("./settings");
var tunnel = require("./tunnel");
var BASE_SELENIUM_PORT_OFFSET = 56000;
var VM_POLLING_TIME = 2500;

var SauceWorkerAllocator = function (_MAX_WORKERS) {
  BaseWorkerAllocator.call(this, _MAX_WORKERS);

  this.tunnels = [];
  this.tunnelErrors = [];
  this.MAX_WORKERS = _MAX_WORKERS;
  this.maxTunnels = sauceSettings.maxTunnels;
  this.tunnelPrefix = Math.round(Math.random() * 99999).toString(16);
};

util.inherits(SauceWorkerAllocator, BaseWorkerAllocator);

SauceWorkerAllocator.prototype.initialize = function (callback) {
  this.initializeWorkers(this.MAX_WORKERS);

  if (!sauceSettings.useTunnels) {
    callback();
  } else {
    tunnel.initialize(function (err) {
      if (err) {
        callback(err);
      } else {
        this.openTunnels(function (err) {
          if (err) {
            callback(new Error("Cannot initialize worker allocator: " + err.toString()));
          } else {
            // NOTE: We wait until we know how many tunnels we actually got before
            // we assign tunnel ids to workers.
            this.assignTunnelsToWorkers(this.tunnels.length);
            callback();
          }
        }.bind(this));
      }
    }.bind(this));
  }
};

SauceWorkerAllocator.prototype.release = function (worker) {
  var self = this;
  if (sauceSettings.locksServerURL) {
    request({
      method: "POST",
      json: true,
      body: {
        token: worker.token
      },
      url: sauceSettings.locksServerURL + "/release"
    }, function (error, response, body) {
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
  if (sauceSettings.locksServerURL) {
    var attempts = 0;

    // Poll the worker allocator until we have a known-good port, then run this test
    var poll = function () {
      console.log("asking for VM..");
      request.post({
        url: sauceSettings.locksServerURL + "/claim",
        form: {}
      }, function (error, response, body) {
        try {
          var result = JSON.parse(body);
          if (result) {
            if (result.accepted) {
              console.log("VM claim accepted, token: " + result.token);
              BaseWorkerAllocator.prototype.get.call(self, function (error, worker) {
                if (worker) {
                  worker.token = result.token;
                }
                callback(error, worker);
              });
            } else {
              console.log("VM claim not accepted, trying again");
              // If we didn't get a worker, try again
              setTimeout(poll, VM_POLLING_TIME);
            }
          } else {
            return callback(new Error("Result from locks server is invalid or empty: '" + result + "'" ));
          }
        } catch (e) {
          return callback(new Error("Could not parse result from locks server: " + e + "\n\nbody of response:" + body));
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
    console.log("Assigning worker " + worker.index + " to tunnel " + worker.tunnelId)
  });
};

SauceWorkerAllocator.prototype.getTunnelId = function (tunnelIndex) {
  return sauceSettings.tunnelId + "_" + this.tunnelPrefix + "_" + tunnelIndex;
};

SauceWorkerAllocator.prototype.teardown = function (callback) {
  if (sauceSettings.useTunnels) {
    this.teardownTunnels(callback);
  } else {
    callback();
  }
};

SauceWorkerAllocator.prototype.openTunnels = function(callback) {
  var self = this;

  var tunnelOpened = function(err, tunnelInfo) {

    if (err) {
      self.tunnelErrors.push(err);
    } else {
      self.tunnels.push(tunnelInfo);
    }

    if (self.tunnels.length === self.maxTunnels) {
      console.log("All tunnels open!  Continuing...");
      callback();
    } else if (self.tunnels.length > 0 && (self.tunnels.length + self.tunnelErrors.length === self.maxTunnels)) {
      // We've accumulated some tunnels and some errors. Continue with a limited number of workers?
      console.log("Opened only " + self.tunnels.length + " tunnels out of " + self.maxTunnels + " requested (due to errors).");
      console.log("Continuing with a reduced number of workers (" + self.tunnels.length + ").")
      callback();
    } else if (self.tunnelErrors.length === self.maxTunnels) {
      // We've tried to open N tunnels but instead got N errors.
      callback(new Error("\nCould not open any sauce tunnels (attempted to open " + self.maxTunnels + " total tunnels): \n" + 
          self.tunnelErrors.map(function(err) {
            return err.toString();
          }).join("\n") + "\nPlease check that there are no sauce-connect-launcher (sc) processes running."
        ));
    } else {
      if (err) {
        console.log("Failed to open a tunnel, number of failed tunnels: " + self.tunnelErrors.length);
      }
      console.log(self.tunnels.length + " of " + self.maxTunnels + " tunnels open.  Waiting...");
    }
  };

  var openTunnel = function(tunnelIndex) {

    var tunnelId = self.getTunnelId(tunnelIndex);
    console.log("Opening tunnel " + tunnelIndex + " of " + self.maxTunnels + " [id = " + tunnelId + "]");

    var options = {
      tunnelId: tunnelId,
      username: sauceSettings.username,
      accessKey: sauceSettings.accessKey,
      seleniumPort: BASE_SELENIUM_PORT_OFFSET + (tunnelIndex + 1),
      callback: tunnelOpened
    };

    tunnel.open(options);
  };

  _.times(this.maxTunnels, function (n) {
    // worker numbers are 1-indexed
    console.log("Waiting " + n + " sec to open tunnel #" + n);
    _.delay(function() {
      openTunnel(n);
    }, n * 1000);
  });

};

SauceWorkerAllocator.prototype.teardownTunnels = function(callback) {
  var self = this;

  var cleanupAndCallback = function () {
    self.cleanupTunnels(callback);
  }

  var tunnelsOriginallyOpen = this.tunnels.length;
  var tunnelsOpen = this.tunnels.length;
  var tunnelCloseTimeout = ( sauceSettings.tunnelTimeout || 60 ) * 1000;

  var closeTimer = setTimeout(function () {
    // sometimes, due to network flake, we never get acknowledgement that the tunnel
    // has been closed.  in such case, we don't want to hang the build indefinitely.
    console.log("Timeout reached waiting for tunnels to close... Continuing...");
    cleanupAndCallback();
  }, tunnelCloseTimeout);

  var tunnelClosed = function() {

    if (--tunnelsOpen === 0) {
      console.log("All tunnels closed!  Continuing...");
      clearTimeout(closeTimer);
      cleanupAndCallback();
    } else {
      console.log(tunnelsOpen + " of " + tunnelsOriginallyOpen + " tunnels still open... waiting...");
    }
  };

  _.each(self.tunnels, function(tunnelInfo) {
    tunnel.close(tunnelInfo, tunnelClosed);
  });
};

SauceWorkerAllocator.prototype.cleanupTunnels = function(callback) {
  // at this point, all sauce tunnel processes have already been sent the SIGTERM signal,
  // meaning they've already been "asked politely" to exit.  if any sauce tunnel processes
  // are still active at this point, we need to forcefully kill them so that we're not
  // leaving the build environment in a polluted state.

  // NOTE: this may not be Windows compatible
  var cmd = "pkill -9 -f " + sauceSettings.tunnelId;

  console.log("Cleaning up any remaining sauce connect processes with: " + cmd);

  exec(cmd, {}, function(error, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    callback();
  });
}


module.exports = SauceWorkerAllocator;