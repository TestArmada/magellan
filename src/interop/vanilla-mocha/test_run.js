/*
  Provide basic support for running a mocha test
*/
var util = require("util");
var _ = require("lodash");
var BaseTestrun = require("../../test_run");

var settings = require("../../settings");
var mochaSettings = require("../lib/mocha_settings");

var MochaTestRun = function (options) {
  BaseTestrun.call(this, options);

  // needed if sauce testing
  this.sauceSettings = options.sauceSettings;
  this.sauceBrowserSettings = _.extend({}, options.sauceBrowserSettings);

  // Remove things Appium doesn't care about
  delete this.sauceBrowserSettings.resolutions;
  delete this.sauceBrowserSettings.id;

  if (options.sauceSettings && options.sauceSettings.useTunnels) {
    this.sauceBrowserSettings.tunnelId = this.worker.tunnelId;
  }

  // needed if local testing
  this.seleniumPort = this.worker.portOffset + 1;

  // needed if you're using a mock
  this.mockingPort = this.worker.portOffset;
};

util.inherits(MochaTestRun, BaseTestrun);

// return the command line path to the test framework binary
MochaTestRun.prototype.getCommand = function () {
  return "./node_modules/.bin/mocha";
};

// return the environment
MochaTestRun.prototype.getEnvironment = function (env) {
  var nodeConfig = require("../lib/amend_node_config")(env, {
    desiredCapabilities: this.sauceBrowserSettings
  });

  return _.extend(env, {
    NODE_CONFIG: JSON.stringify(nodeConfig)
  });
};

MochaTestRun.prototype.getArguments = function () {
  var grepString = this.path.fullTitle;
  var escapees = "\\^$[]+*.\"";
  escapees.split("").forEach(function (ch) {
    grepString = grepString.split(ch).join("\\" + ch);
  });

  var args = [
    "--mocking_port=" + this.mockingPort,
    "--worker=1",
    "-g",
    grepString
  ];

  if (mochaSettings.mochaOpts) {
    args.push("--opts", mochaSettings.mochaOpts);
  }

  args = args.concat(mochaSettings.mochaTestFolders);

  return args;
};

module.exports = MochaTestRun;
