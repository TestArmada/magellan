/*
  Provide basic support for running a mocha test
*/
var util = require("util");
var _ = require("lodash");
var BaseTestrun = require("../../test_run");

var settings = require("../../settings");

var MochaTestRun = function (options) {
  BaseTestrun.call(this, options);

  // needed if sauce testing
  this.sauceSettings = options.sauceSettings;
  this.sauceBrowserSettings = _.extend({}, options.sauceBrowserSettings);

  // Remove things Appium doesn't care about
  delete this.sauceBrowserSettings.resolutions;
  delete this.sauceBrowserSettings.id;

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
  var config = {
    desiredCapabilities: this.sauceBrowserSettings,
    appiumAppLocation: settings.appiumApplicationLocation,
    sauceSettings: {
      testServer: "http://" + process.env.SAUCE_USERNAME + ":" + process.env.SAUCE_ACCESS_KEY + "@ondemand.saucelabs.com:80/wd/hub"
    }
  };

  return _.extend({
    NODE_CONFIG: JSON.stringify(config)
  }, env);
};

MochaTestRun.prototype.getArguments = function () {
  var grepString = this.path.toString();
  var escapees = "\\^$[]*.\"";
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
