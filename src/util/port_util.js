/* eslint operator-assignment: 0 */
"use strict";

var _ = require("lodash");

var settings = require("../settings");
var checkPorts = require("./check_ports");

var MAX_ACQUIRE_ATTEMPTS = 100;
var MAX_PORT = settings.BASE_PORT_START + settings.BASE_PORT_RANGE - 1;
var portCursor;

var util = {

  // Return magellan's internal port cursor, i.e. the next port that can potentially
  // be probed for availability. This doesn't perform a port contention check. Calling
  // this function also ticks the port cursor upwards regardless of result.
  getNextPort: function () {
    // Reset back to start of range
    if (typeof portCursor === "undefined" || portCursor + settings.BASE_PORT_SPACING > MAX_PORT) {
      portCursor = settings.BASE_PORT_START;
    }

    // Choose the next port
    var nextPort = portCursor;

    // Allocate the port for the next worker -- or spill over the range
    portCursor = portCursor + settings.BASE_PORT_SPACING;
    return nextPort;
  },

  // Call callback(err, foundPort) with either:
  //
  // 1) an Error object, if we couldnt' find a port
  // 2) null and a foundPort as the second argument
  acquirePort: function (callback, opts) {
    var runOpts = _.assign({
      checkPorts: checkPorts
    }, opts);

    var attempts = 0;
    var acquire = function () {
      runOpts.checkPorts([util.getNextPort()], function (result) {
        if (result[0].available) {
          return callback(null, result[0].port);
        } else {
          attempts++;
          if (attempts > MAX_ACQUIRE_ATTEMPTS) {
            return callback(new Error("Gave up looking for an available port after "
              + MAX_ACQUIRE_ATTEMPTS + " attempts."));
          } else {
            acquire();
          }
        }
      });
    };

    acquire();
  },

  checkPorts: checkPorts
};

module.exports = util;
