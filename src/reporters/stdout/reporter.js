"use strict";

/*
* Stdout Reporter
*
* This reporter streams the output from a test run directly to stdout/stderr, to allow
* for easier live debugging at the console.
*/

var util = require("util");
var BaseReporter = require("../reporter");

var Reporter = function () {
};

util.inherits(Reporter, BaseReporter);

Reporter.prototype.listenTo = function (testRun, source) {
  // Stream stdout and stderr directly to stdout, assuming this source is
  // a process that has those properties.
  if (source.stdout) {
    source.stdout.pipe(process.stdout);
  }
  if (source.stderr) {
    source.stderr.pipe(process.stderr);
  }
};

module.exports = Reporter;
