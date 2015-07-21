// Base Test Run
// This module represents an individual "run" of a given test in a given browser.

var mkdirSync = require("./mkdir_sync");
var path = require("path");
var settings = require("./settings");

var TestRun = function (options) {
  // temporary assets have to be split into individual runs or else we end up
  // clobbering assets or ending up with screenshots from different tests all
  // in the same directory.
  this.childBuildId = Math.round(Math.random() * 9999999999).toString(16);

  this.test = options.test;

  // Path to individual test file
  this.path = this.test.path;

  // The worker assigned to the run of this test
  this.worker = options.worker;

  this.debug = options.debug;

  // At the same time, some reporting, etc, has to be tied to the overall 
  // magellan run by a singular build id, and this is used to identify
  // the entire suite running together. Storing the buildId here allows certain
  // reporters to get access to the overall build's identity so they can tie
  // sub-assets to that parent build.
  this.buildId = options.buildId;

  this.tempAssetPath = path.resolve(settings.tempDir + "/build-" + this.buildId + "_" + this.childBuildId + "_" + "_temp_assets");

  mkdirSync(this.tempAssetPath);
};

TestRun.prototype = {

  // These methods are intended as stubs and should be overridden by a testing
  // framework support implementation (eg: nightwatch, protractor, etc).

  // stub for the full or relative command path used to execute a build. This
  // should not include any arguments (see getArguments below). Required.
  getCommand: function () {
    return;
  },

  // stub for the process.env that should be created for a build's child process.
  // By default, this is empty, since we prefer not to use environment variables
  // to pass along any information from magellan to child builds.
  getEnvironment: function (env) {
    return _.extend({}, env);
  },

  // stub for the arguments list that is passed to a given framework. Minimally,
  // this should be implemented such that the name of the test and probably browser
  // name is passed along, but depending on implementation detail, not required.
  getArguments: function () {
    return [];
  }
};

module.exports = TestRun;