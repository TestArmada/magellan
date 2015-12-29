/*
  Provide basic support for running a mocha test without rowdy
  (selenium integration, appium usage, or lack of either, is up to test framework code)
*/
var _ = require("lodash");

var settings = require("../../settings");

var MochaTestRun = function (options) {
  _.extend(this, options);

  this.sauceBrowserSettings = _.extend({}, this.sauceBrowserSettings);

  // Remove things Appium doesn't care about
  delete this.sauceBrowserSettings.resolutions;
  delete this.sauceBrowserSettings.id;

  // Copy tunnelId into sauce settings since this is not done for us
  if (options.sauceSettings && options.sauceSettings.useTunnels) {
    this.sauceBrowserSettings.tunnelId = options.tunnelId;
  }
};

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
  var grepString = this.path.toString();
  var escapees = "\\^$[]+*.\"";
  escapees.split("").forEach(function (ch) {
    grepString = grepString.split(ch).join("\\" + ch);
  });

  var args = [
    "--mocking_port=" + this.mockingPort,
    "--worker=1",
    this.path.filename,
    "-g",
    grepString
  ];

  return args;
};

module.exports = MochaTestRun;
