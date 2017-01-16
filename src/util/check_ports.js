"use strict";

const _ = require("lodash");
const request = require("request");
const portscanner = require("portscanner");

const PORT_STATUS_IN_USE = 0;
const PORT_STATUS_AVAILABLE = 1;

const checkPortStatus = (desiredPort, callback, opts) => {
  const runOpts = _.assign({
    request,
    portscanner,
    console
  }, opts);

  runOpts.request("http://127.0.0.1:" + desiredPort +
    "/wd/hub/static/resource/hub.html", (seleniumErr) => {
    if (seleniumErr && seleniumErr.code === "ECONNREFUSED") {
      runOpts.portscanner.checkPortStatus(desiredPort, "127.0.0.1", (error, portStatus) => {
        if (portStatus === "open") {
          return callback(PORT_STATUS_IN_USE);
        } else {
          return callback(PORT_STATUS_AVAILABLE);
        }
      });
    } else {
      runOpts.console.log(
        "Found selenium HTTP server at port " + desiredPort + ", port is in use.");
      return callback(PORT_STATUS_IN_USE);
    }
  });
};

//
// Given an array portNumbers of the form:
//
// [1234, 5678, ...]
//
// checkPortRange will call callback() with a list of port statuses in the form:
//
// [{ port: number, available: boolean }]
//
const checkPortRange = (portNumbers, callback, opts) => {
  portNumbers = _.cloneDeep(portNumbers);
  const statuses = [];

  const checkNextPort = () => {
    if (portNumbers.length > 0) {
      const portToCheck = portNumbers.shift();

      checkPortStatus(portToCheck, (portStatus) => {
        statuses.push({
          port: portToCheck,
          available: portStatus === PORT_STATUS_AVAILABLE
        });
        checkNextPort();
      }, opts);
    } else {
      return callback(statuses);
    }
  };

  checkNextPort();
};

module.exports = checkPortRange;
