/*
  Provide
*/
var util = require("util");
var _ = require("lodash");
var BaseTestrun = require("../../test_run");

var settings = require("../../settings");
var mochaSettings = require("../lib/mocha_settings");

var RowdyMochaTestRun = function (options) {
  BaseTestrun.call(this, options);

  if (options.sauceBrowserSettings) {
    this.rowdyBrowser = "sauceLabs." + options.sauceBrowserSettings.id;
  } else {
    this.rowdyBrowser = "local." + this.test.browser.browserId;
  }

  if (options.sauceSettings && options.sauceSettings.useTunnels) {
    this.tunnelId = this.worker.tunnelId;
  }

  // needed if local testing
  this.seleniumPort = this.worker.portOffset + 1;

  // needed if you're using a mock
  this.mockingPort = this.worker.portOffset;
};

util.inherits(RowdyMochaTestRun, BaseTestrun);

// return the command line path to the test framework binary
RowdyMochaTestRun.prototype.getCommand = function () {
  return "./node_modules/.bin/mocha";
};

// return the environment
RowdyMochaTestRun.prototype.getEnvironment = function (env) {
  /*
    Several ways to tell a mocha client where to find its mocking port:

    NODE_CONFIG object ( i.e http://npmjs.org/packages/config )
    process.env.MOCKING_PORT
    process.env.FUNC_PORT
    --mocking_port=NNN (process.argv)
  */
  var mockingSettings = {
    MOCKING_PORT: this.mockingPort,
    FUNC_PORT: this.mockingPort
  };

  var nodeConfig = require("../lib/amend_node_config")(env, mockingSettings);

  var rowdySettings = {
    // Example values for rowdy:
    // "local.phantomjs"
    // "sauceLabs.safari_7_OS_X_10_9_Desktop"
    NODE_CONFIG: JSON.stringify(nodeConfig),
    ROWDY_SETTINGS: this.rowdyBrowser,
    ROWDY_OPTIONS: JSON.stringify({
      "server": {
        "port": this.seleniumPort
      },
      "client": {
        "port": this.seleniumPort
      }
    })
  };

  if (this.tunnelId) {
    rowdySettings.SAUCE_CONNECT_TUNNEL_ID = this.tunnelId;
  }

  return _.extend(env, mockingSettings, rowdySettings);
};

RowdyMochaTestRun.prototype.getArguments = function () {
  var grepString = this.path.toString();

  var escapees = "\\^$[]+*.\"";
  escapees.split("").forEach(function (ch) {
    grepString = grepString.split(ch).join("\\" + ch);
  });

  var args = [
    "--mocking_port=" + this.mockingPort,
    "--worker=1",
    this.path.filename
  ];

  if (mochaSettings.mochaOpts) {
    args.push("--opts");
    args.push(mochaSettings.mochaOpts);
  }

  args.push("-g");
  args.push(grepString);

  return args;
};

module.exports = RowdyMochaTestRun;
