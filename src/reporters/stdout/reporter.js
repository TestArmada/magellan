"use strict";

/*
* Stdout Reporter
*
* This reporter streams the output from a test run directly to stdout/stderr, to allow
* for easier live debugging at the console.
*/

const BaseReporter = require("../reporter");

class Reporter extends BaseReporter {
  constructor() {
    super();
  }

  listenTo(testRun, test, source) {
    // Stream stdout and stderr directly to stdout, assuming this source is
    // a process that has those properties.
    if (source.stdout) {
      source.stdout.pipe(process.stdout);
    }
    if (source.stderr) {
      source.stderr.pipe(process.stderr);
    }
  }
}

module.exports = Reporter;
