var _ = require("lodash");
var portscanner = require("portscanner");
var clc = require("cli-color");
var request = require("request");
var settings = require("./settings");

var PORT_STATUS_IN_USE = 0;
var PORT_STATUS_AVAILABLE = 1;

var BASE_PORT_START = settings.BASE_PORT_START;
var BASE_PORT_RANGE = settings.BASE_PORT_RANGE;
var BASE_PORT_SPACING = settings.BASE_PORT_SPACING;

var BASE_PORT_OFFSET = BASE_PORT_START;
var MAX_PORT = (BASE_PORT_START + BASE_PORT_RANGE) - 1;

var MAX_ALLOCATION_ATTEMPTS = 120;
var WORKER_START_DELAY = 1000;

var portCursor;
// Return the next port to be used. Note that this doesn't perform a port contention check, checkPortStatus does
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

var checkPortStatus = function (desiredPort, callback) {
  request("http://127.0.0.1:" + desiredPort + "/wd/hub/static/resource/hub.html", function (error, response, body) {
    if (error && error.code === "ECONNREFUSED") {
      portscanner.checkPortStatus(desiredPort, "127.0.0.1", function (error, portStatus) {
        if (portStatus === "open") {
          callback(PORT_STATUS_IN_USE);
        } else {
          callback(PORT_STATUS_AVAILABLE);
        }
      });
    } else {
      console.log("Found selenium HTTP server at port " + desiredPort + ", port is in use.");
      callback(PORT_STATUS_IN_USE);
    }
  })
};


// Create a worker allocator for MAX_WORKERS workers. Note that the allocator
// is not obliged to honor the creation of MAX_WORKERS, just some number of workers
// between 0 and MAX_WORKERS.
var Allocator = function (MAX_WORKERS) {
  if (settings.debug) {
    console.log("Worker Allocator starting.");
    console.log("Port allocation range from: " + BASE_PORT_OFFSET + " to " + MAX_PORT + " with " + BASE_PORT_SPACING + " ports available to each worker.");
  }

  this.initializeWorkers(MAX_WORKERS);
};

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
          callback(null, worker);
        } else {
          if (attempts > MAX_ALLOCATION_ATTEMPTS) {
            var errorMessage = "Couldn't allocate a worker after " + MAX_ALLOCATION_ATTEMPTS + " attempts";
            callback(errorMessage);
          } else {
            // If we didn't get a worker, try again
            setTimeout(poll, WORKER_START_DELAY);      
          }
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

      checkPortStatus(portOffset, function (mockingPortStatus) {
        checkPortStatus(portOffset + 1, function (seleniumPortStatus) {
          if (mockingPortStatus === PORT_STATUS_AVAILABLE && seleniumPortStatus === PORT_STATUS_AVAILABLE) {
            availableWorker.portOffset = portOffset;
            availableWorker.occupied = true;

            callback(availableWorker);
          } else {
            console.log(
              clc.yellowBright("Worker detected port contention, waiting... "
              + "(mocking port " + portOffset + " " + (mockingPortStatus === PORT_STATUS_AVAILABLE ? "available" : "in use") 
              + ", selenium port " + (portOffset + 1) + (seleniumPortStatus === PORT_STATUS_AVAILABLE ? "available" : "in use")
              + ")"));

            // release the worker we can't use, allow a later attempt
            availableWorker.occupied = false;
            callback(undefined);
          }
        });
      })
    } else {
      callback(undefined);
    }
  },

  release: function (executor) {
    executor.occupied = false;
  }

};

module.exports = Allocator;