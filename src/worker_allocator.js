"use strict";

const _ = require("lodash");
const settings = require("./settings");
const portUtil = require("./util/port_util");
const logger = require("../src/logger");

const MAX_ALLOCATION_ATTEMPTS = 120;
const WORKER_START_DELAY = 1000;

// Create a worker allocator for MAX_WORKERS workers. Note that the allocator
// is not obliged to honor the creation of MAX_WORKERS, just some number of workers
// between 0 and MAX_WORKERS.
class Allocator {
  constructor(MAX_WORKERS, opts) {
    _.assign(this, {
      setTimeout,
      checkPorts: portUtil.checkPorts,
      getNextPort: portUtil.getNextPort,
      debug: settings.debug
    }, opts);

    logger.debug("Worker Allocator starting.");
    logger.debug("Port allocation range from: " + settings.BASE_PORT_START + " to "
      + (settings.BASE_PORT_START + settings.BASE_PORT_RANGE - 1) + " with "
      + settings.BASE_PORT_SPACING + " ports available to each worker.");


    this.initializeWorkers(MAX_WORKERS);
  }

  initialize(callback) {
    callback();
  }

  teardown(callback) {
    callback();
  }

  initializeWorkers(numWorkers) {
    this.workers = [];

    for (let i = 1; i < numWorkers + 1; i++) {
      this.workers.push({
        index: i,
        occupied: false,
        portOffset: undefined
      });
    }
  }

  get(callback) {
    let attempts = 0;

    // Poll the worker allocator until we have a known-good port, then run this test
    const poll = () => {
      this._get((worker) => {
        attempts++;
        if (worker) {
          return callback(null, worker);
        } else if (attempts > MAX_ALLOCATION_ATTEMPTS) {
          const errorMessage = "Couldn't allocate a worker after " + MAX_ALLOCATION_ATTEMPTS
            + " attempts";
          return callback(errorMessage);
        } else {
          // If we didn't get a worker, try again
          this.setTimeout(poll, WORKER_START_DELAY);
        }
      });
    };

    this.setTimeout(poll, WORKER_START_DELAY);
  }

  _get(callback) {
    const availableWorker = _.find(this.workers, (e) => !e.occupied);

    if (availableWorker) {
      // occupy this worker while we test if we can use it
      availableWorker.occupied = true;

      const portOffset = this.getNextPort();

      // Standard Magellan port convention: 
      // let n = settings.BASE_PORT_SPACING - 1;
      // portOffset     : selenium server
      // portOffset + 1 : pre-assigned for mocking (available for application to use)
      // ...
      // portOffset + n : available for application to use
      const desiredPortLabels = ["selenium port"];
      const desiredPorts = [];

      // if BASE_PORT_SPACING is the default of 3, we'll check 3 ports
      for (let i = 0; i < settings.BASE_PORT_SPACING; i++) {
        desiredPorts.push(portOffset + i);
      }

      this.checkPorts(desiredPorts, (statuses) => {
        if (_.every(statuses, (status) => status.available)) {
          availableWorker.portOffset = portOffset;
          availableWorker.occupied = true;

          return callback(availableWorker);
        } else {
          // Print a message that ports are not available, show which ones in the range
          availableWorker.occupied = false;

          logger.warn("Detected port contention while spinning up worker: ");
          statuses.forEach((status, portIndex) => {
            if (!status.available) {
              logger.warn("  in use: #: " + status.port + " purpose: "
                + (desiredPortLabels[portIndex] ? desiredPortLabels[portIndex] : "generic"));
            }
          });

          return callback(undefined);
        }
      });
    } else {
      return callback(undefined);
    }
  }

  release(worker) {
    worker.occupied = false;
  }
}

module.exports = Allocator;
