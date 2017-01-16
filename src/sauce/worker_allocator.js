/* eslint no-invalid-this: 0 */
"use strict";

const BaseWorkerAllocator = require("../worker_allocator");
const _ = require("lodash");
const request = require("request");

const sauceSettings = require("./settings")();
const settings = require("../settings");
const analytics = require("../global_analytics");
const guid = require("../util/guid");
const tunnel = require("./tunnel");

const BASE_SELENIUM_PORT_OFFSET = 56000;
const SECOND_MS = 1000;
const SECONDS_MINUTE = 60;

class SauceWorkerAllocator extends BaseWorkerAllocator {
  constructor(_MAX_WORKERS, opts) {
    super(_MAX_WORKERS, opts);

    _.assign(this, {
      console,
      sauceSettings,
      request,
      clearTimeout,
      setTimeout,
      tunnel,
      analytics,
      settings,
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

  initialize(callback) {
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
      this.tunnel.initialize((initErr) => {
        if (initErr) {
          return callback(initErr);
        } else {
          this.analytics.push("sauce-open-tunnels");
          this.openTunnels((openErr) => {
            if (openErr) {
              this.analytics.mark("sauce-open-tunnels", "failed");
              return callback(new Error("Cannot initialize worker allocator: " +
                openErr.toString()));
            } else {
              // NOTE: We wait until we know how many tunnels we actually got before
              // we assign tunnel ids to workers.
              this.analytics.mark("sauce-open-tunnels");
              this.assignTunnelsToWorkers(this.tunnels.length);
              return callback();
            }
          });
        }
      });
    }
  }

  release(worker) {
    if (this.sauceSettings.locksServerLocation) {
      this.request({
        method: "POST",
        json: true,
        timeout: this.sauceSettings.locksRequestTimeout,
        body: {
          token: worker.token
        },
        url: this.sauceSettings.locksServerLocation + "/release"
      }, () => {
        // TODO: decide whether we care about an error at this stage. We're releasing
        // this worker whether the remote release is successful or not, since it will
        // eventually be timed out by the locks server.
        super.release.call(this, worker);
      });
    } else {
      super.release.call(this, worker);
    }
  }

  get(callback) {
    //
    // http://0.0.0.0:3000/claim
    //
    // {"accepted":false,"message":"Claim rejected. No VMs available."}
    // {"accepted":true,"token":null,"message":"Claim accepted"}
    //
    if (this.sauceSettings.locksServerLocation) {
      const pollingStartTime = Date.now();

      // Poll the worker allocator until we have a known-good port, then run this test
      const poll = () => {
        if (this.settings.debug) {
          this.console.log("asking for VM..");
        }
        this.request.post({
          url: this.sauceSettings.locksServerLocation + "/claim",
          timeout: this.sauceSettings.locksRequestTimeout,
          form: {}
        }, (error, response, body) => {
          try {
            if (error) {
              throw new Error(error);
            }

            const result = JSON.parse(body);
            if (result) {
              if (result.accepted) {
                if (this.settings.debug) {
                  this.console.log("VM claim accepted, token: " + result.token);
                }
                super.get.call(this, (getWorkerError, worker) => {
                  if (worker) {
                    worker.token = result.token;
                  }
                  callback(getWorkerError, worker);
                });
              } else {
                if (this.settings.debug) {
                  this.console.log("VM claim not accepted, waiting to try again ..");
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
            if (Date.now() - pollingStartTime > this.sauceSettings.locksOutageTimeout) {
              // we've been polling for too long. Bail!
              return callback(new Error("Gave up trying to get "
                  + "a saucelabs VM from locks server. " + e));
            } else {
              if (this.settings.debug) {
                this.console.log("Error from locks server, tolerating error and" +
                  " waiting " + this.sauceSettings.locksPollingInterval +
                  "ms before trying again");
              }
              this.setTimeout(poll, this.sauceSettings.locksPollingInterval);
            }
          }
        });
      };

      poll();
    } else {
      super.get.call(this, callback);
    }
  }

  assignTunnelsToWorkers(numOpenedTunnels) {
    // Assign a tunnel id for each worker.
    this.workers.forEach((worker, i) => {
      worker.tunnelId = this.getTunnelId(i % numOpenedTunnels);
      this.console.log("Assigning worker " + worker.index + " to tunnel " + worker.tunnelId);
    });
  }

  getTunnelId(tunnelIndex) {
    if (this.sauceSettings.sauceTunnelId) {
      // if sauce tunnel id exists
      return this.sauceSettings.sauceTunnelId;
    } else {
      return this.tunnelPrefix + "_" + tunnelIndex;
    }
  }

  teardown(callback) {
    if (this.sauceSettings.useTunnels) {
      this.teardownTunnels(callback);
    } else {
      return callback();
    }
  }

  openTunnels(callback) {
    const tunnelOpened = (err, tunnelInfo) => {

      if (err) {
        this.tunnelErrors.push(err);
      } else {
        this.tunnels.push(tunnelInfo);
      }

      if (this.tunnels.length === this.maxTunnels) {
        this.console.log("All tunnels open!  Continuing...");
        return callback();
      } else if (this.tunnels.length > 0
          && this.tunnels.length + this.tunnelErrors.length === this.maxTunnels) {
        // We've accumulated some tunnels and some errors. Continue
        // with a limited number of workers?
        this.console.log("Opened only " + this.tunnels.length + " tunnels out of "
          + this.maxTunnels + " requested (due to errors).");
        this.console.log("Continuing with a reduced number of workers ("
          + this.tunnels.length + ").");
        return callback();
      } else if (this.tunnelErrors.length === this.maxTunnels) {
        // We've tried to open N tunnels but instead got N errors.
        return callback(new Error("\nCould not open any sauce tunnels (attempted to open "
          + this.maxTunnels + " total tunnels): \n" +
            this.tunnelErrors.map((tunnelErr) => {
              return tunnelErr.toString();
            }).join("\n") + "\nPlease check that there are no "
              + "sauce-connect-launcher (sc) processes running."
          ));
      } else {
        if (err) {
          this.console.log("Failed to open a tunnel, number of failed tunnels: "
            + this.tunnelErrors.length);
        }
        this.console.log(
          this.tunnels.length + " of " + this.maxTunnels + " tunnels open.  Waiting..."
        );
      }
    };

    const openTunnel = (tunnelIndex) => {

      const tunnelId = this.getTunnelId(tunnelIndex);
      this.console.log("Opening tunnel " + tunnelIndex + " of "
        + this.maxTunnels + " [id = " + tunnelId + "]");

      const options = {
        tunnelId,
        seleniumPort: BASE_SELENIUM_PORT_OFFSET + (tunnelIndex + 1),
        callback: tunnelOpened
      };

      this.tunnel.open(options);
    };

    _.times(this.maxTunnels, (n) => {
      // worker numbers are 1-indexed
      this.console.log("Waiting " + n + " sec to open tunnel #" + n);
      this.delay(() => openTunnel(n), n * SECOND_MS);
    });
  }

  teardownTunnels(callback) {
    const tunnelsOriginallyOpen = this.tunnels.length;
    let tunnelsOpen = this.tunnels.length;
    const tunnelCloseTimeout = (this.sauceSettings.tunnelTimeout || SECONDS_MINUTE) * SECOND_MS;

    const closeTimer = this.setTimeout(() => {
      // NOTE: We *used to* forcefully clean up stuck tunnels in here, but instead,
      // we now leave the tunnel processes for process_cleanup to clean up.
      this.console.log("Timeout reached waiting for tunnels to close... Continuing...");
      return callback();
    }, tunnelCloseTimeout);

    const tunnelClosed = () => {

      if (--tunnelsOpen === 0) {
        this.console.log("All tunnels closed!  Continuing...");
        this.clearTimeout(closeTimer);
        return callback();
      } else {
        this.console.log(tunnelsOpen + " of " + tunnelsOriginallyOpen
          + " tunnels still open... waiting...");
      }
    };

    _.each(this.tunnels, (tunnelInfo) => {
      this.tunnel.close(tunnelInfo, tunnelClosed);
    });
  }
}

module.exports = SauceWorkerAllocator;
