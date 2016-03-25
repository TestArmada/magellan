"use strict";

var _ = require("lodash");
var clc = require("cli-color");
var settings = require("./settings");
var checkPortRange = require("./util/check_port_range");

var BASE_PORT_START = settings.BASE_PORT_START;
var BASE_PORT_RANGE = settings.BASE_PORT_RANGE;
var BASE_PORT_SPACING = settings.BASE_PORT_SPACING;

var BASE_PORT_OFFSET = BASE_PORT_START;
var MAX_PORT = BASE_PORT_START + BASE_PORT_RANGE - 1;

var MAX_ALLOCATION_ATTEMPTS = 120;
var WORKER_START_DELAY = 1000;

var portCursor;

// Return the next port to be used. This doesn't perform a port contention check
var getNextPort = function () {
  // Reset back to start of range
  if (typeof portCursor === "undefined" || portCursor + BASE_PORT_SPACING > MAX_PORT) {
    portCursor = BASE_PORT_OFFSET;
  }

  // Choose the next port
  var nextPort = portCursor;

  // Allocate the port for the next worker -- or spill over the range
  portCursor = portCursor + BASE_PORT_SPACING;
  return nextPort;
};

// Create a worker allocator for MAX_WORKERS workers. Note that the allocator
// is not obliged to honor the creation of MAX_WORKERS, just some number of workers
// between 0 and MAX_WORKERS.
function Allocator(MAX_WORKERS) {
  if (settings.debug) {
    console.log("Worker Allocator starting.");
    console.log("Port allocation range from: " + BASE_PORT_OFFSET + " to " + MAX_PORT + " with "
      + BASE_PORT_SPACING + " ports available to each worker.");
  }

  this.initializeWorkers(MAX_WORKERS);
}

Allocator.prototype = {

  initialize: function (callback) {
    callback();
  },

  teardown: function (callback) {
    callback();
  },

  initializeWorkers: function (numWorkers) {
    this.workers = [];

    for (var i = 1; i < numWorkers + 1; i++) {
      this.workers.push({
        index: i,
        occupied: false,
        portOffset: undefined
      });
    }
  },

  get: function (callback) {
    var attempts = 0;

    // Poll the worker allocator until we have a known-good port, then run this test
    var poll = function () {
      this._get(function (worker) {
        attempts++;
        if (worker) {
          return callback(null, worker);
        } else if (attempts > MAX_ALLOCATION_ATTEMPTS) {
          var errorMessage = "Couldn't allocate a worker after " + MAX_ALLOCATION_ATTEMPTS
            + " attempts";
          return callback(errorMessage);
        } else {
          // If we didn't get a worker, try again
          setTimeout(poll, WORKER_START_DELAY);
        }
      }.bind(this));
    }.bind(this);

    setTimeout(poll, WORKER_START_DELAY);
  },

  _get: function (callback) {
    var availableWorker = _.find(this.workers, function (e) {
      return !e.occupied;
    });

    if (availableWorker) {
      // occupy this worker while we test if we can use it
      availableWorker.occupied = true;

      var portOffset = getNextPort();

      // Standard Magellan convention: port = mock, port + 1 = selenium
      // Other ports after this within the BASE_PORT_SPACING range can
      // be used for whatever the user desires, so those are labelled
      // as "generic" (if found to be occupied, that is).
      var desiredPortLabels = ["mocking port", "selenium port"];
      var desiredPorts = [];

      // if BASE_PORT_SPACING is the default of 3, we'll check 3 ports
      for (var i = 0; i < BASE_PORT_SPACING; i++) {
        desiredPorts.push(portOffset + i);
      }

      checkPortRange(desiredPorts, function (statuses) {
        if (_.every(statuses, function (status) { return status.available; })) {
          availableWorker.portOffset = portOffset;
          availableWorker.occupied = true;

          return callback(availableWorker);
        } else {
          // Print a message that ports are not available, show which ones in the range
          availableWorker.occupied = false;

          console.log(clc.yellowBright("Detected port contention while spinning up worker: "));
          statuses.forEach(function (status, portIndex) {
            if (!status.available) {
              console.log(clc.yellowBright("  in use: #: " + status.port + " purpose: "
                + (desiredPortLabels[portIndex] ? desiredPortLabels[portIndex] : "generic")));
            }
          });

          return callback(undefined);
        }
      });
    } else {
      return callback(undefined);
    }
  },

  release: function (worker) {
    worker.occupied = false;
  }

};

module.exports = Allocator;
