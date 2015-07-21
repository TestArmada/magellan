var util = require("util")
var BaseWorkerAllocator = require("../worker_allocator");
var _ = require("lodash");

var exec = require("child_process").exec;

var sauceSettings = require("./settings");
var tunnel = require("./tunnel");
var BASE_SELENIUM_PORT_OFFSET = 56000;

var SauceWorkerAllocator = function (_MAX_WORKERS) {
  BaseWorkerAllocator.call(this, _MAX_WORKERS);

  this.tunnels = [];
  this.tunnelErrors = [];
  this.MAX_WORKERS = _MAX_WORKERS;
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
            // NOTE: If we only managed to fewer tunnels than we requested,
            // we need to reduce the number of workers.
            if (this.tunnels.length !== this.MAX_WORKERS) {
              this.initializeWorkers(this.tunnels.length);
            }
            callback();
          }
        }.bind(this));
      }
    }.bind(this));
  }
};

SauceWorkerAllocator.prototype.initializeWorkers = function (numWorkers) {
  BaseWorkerAllocator.prototype.initializeWorkers.call(this, numWorkers);

  if (sauceSettings.useTunnels) {
    // Assign a tunnel id for each worker.
    this.workers.forEach(function (worker){
      worker.tunnelId = sauceSettings.tunnelId + "_" + (worker.index) + "_" + Math.round(Math.random() * 99999).toString(16);
    });
  }
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

    if (self.tunnels.length === self.MAX_WORKERS) {
      console.log("All tunnels open!  Continuing...");
      callback();
    } else if (self.tunnels.length > 0 && (self.tunnels.length + self.tunnelErrors.length === self.MAX_WORKERS)) {
      // We've accumulated some tunnels and some errors. Continue with a limited number of workers?
      console.log("Opened only " + self.tunnels.length + " tunnels out of " + self.MAX_WORKERS + " requested (due to errors).");
      console.log("Continuing with a reduced number of workers (" + self.tunnels.length + ").")
      callback();
    } else if (self.tunnelErrors.length === self.MAX_WORKERS) {
      // We've tried to open N tunnels but instead got N errors.
      callback(new Error("\nCould not open any sauce tunnels (attempted to open " + self.MAX_WORKERS + " total tunnels): \n" + 
          self.tunnelErrors.map(function(err) {
            return err.toString();
          }).join("\n") + "\nPlease check that there are no sauce-connect-launcher (sc) processes running."
        ));
    } else {
      if (err) {
        console.log("Failed to open a tunnel, number of failed tunnels: " + self.tunnelErrors.length);
      }
      console.log(self.tunnels.length + " of " + self.MAX_WORKERS + " tunnels open.  Waiting...");
    }
  };

  var openTunnel = function(tunnelNum) {

    console.log("Opening tunnel " + tunnelNum + " of " + self.MAX_WORKERS);

    var options = {
      // NOTE: Workers are indexed from 1 for readability purposes, but worker 1 is at index 0.
      tunnelId: self.workers[tunnelNum - 1].tunnelId,
      username: sauceSettings.username,
      accessKey: sauceSettings.accessKey,
      seleniumPort: BASE_SELENIUM_PORT_OFFSET + tunnelNum,
      callback: tunnelOpened
    };

    tunnel.open(options);
  };

  _.times(this.MAX_WORKERS, function(n) {
    // worker numbers are 1-indexed
    n = n + 1;
    console.log("Waiting " + n + " sec to open tunnel #" + n);
    _.delay(function() {
      openTunnel(n);
    }, n * 2000);
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

  var cmd = "pkill -9 -f " + sauceSettings.tunnelId;

  console.log("Cleaning up any remaining sauce connect processes with: " + cmd);

  exec(cmd, {}, function(error, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    callback();
  });
}


module.exports = SauceWorkerAllocator;