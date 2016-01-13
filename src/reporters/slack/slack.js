"use strict";

/*
* Slack integration for Magellan runs
*
* When running in a CI environment, reports test failures
* based on the following environment variables:
*
* MAGELLAN_SLACK_API_KEY : Webhook key set up in Slack settings
* MAGELLAN_SLACK_NOTIFY_CHANNEL : Channel to post messages
*
*/

var _ = require("lodash");
var Slack = require("node-slackr");
var Q = require("q");
var BaseReporter = require("../reporter");
var util = require("util");

function Reporter(config) {
  this.config = config;
  this.failures = [];
}

util.inherits(Reporter, BaseReporter);

Reporter.prototype.initialize = function () {
  var deferred = Q.defer();
  var self = this;

  console.log("Magellan Slack Reporter initializing..");

  // Before setting up the node-slackr instance, verify we have everything we need.
  // If we don't, print the missing configuration variables and reject the promise.
  var hasAllConfig = true;
  [
    // slack-related
    "account",
    "key",
    "channel",
    "username",
    "iconURL",
    // job related
    "jobName",
    "buildDisplayName",
    "buildURL"
  ].forEach(function (key) {
    if (!self.config.hasOwnProperty(key)) {
      hasAllConfig = false;
      console.error("Missing Slack configuration variable: " + key);
    }
  });
  if (!hasAllConfig) {
    deferred.reject(new Error("Error: Missing required Slack configuration variables"));
  }

  this.jobName = this.config.jobName;
  this.buildDisplayName = this.config.buildDisplayName;
  this.buildURL = this.config.buildURL;

  this.slack = new Slack(this.config.account, this.config.key, {
    channel: this.config.channel,
    username: this.config.username,
    /*eslint-disable camelcase*/
    icon_url: this.config.iconURL
  });

  deferred.resolve();
  return deferred.promise;
};

Reporter.prototype.listenTo = function (testRun, source) {
  // Every time a message is received regarding this test, we also get the test object
  // itself so that we're able to reason about retries, worker index, etc.
  source.addListener("message", this._handleMessage.bind(this, testRun));
};

/*
* Sends complete failure message to Slack channel.  For example:
*
* ================ FAILURES in SauceLabs_Test #321 [Netscape Navigator 2.1] ================
* 1) Smoke Scenario 6 [ https://saucelabs.com/tests/..... ]
* 2) Smoke Scenario 7 [ https://saucelabs.com/tests/..... ] (2 uncaught errors detected)
* 3) Smoke Scenario 22 [ https://saucelabs.com/tests/..... ]
*
* Build Log: http://cihost/job/Magellan_SauceLabs/123/consoleFull
*
* */
Reporter.prototype.flush = function () {
  if (this.failures.length > 0) {
    var output = _.map(this.failures, function (failure, i) {
      var browserErrorsNote = "";
      if (failure.browserErrors && failure.browserErrors.length > 0) {
        browserErrorsNote = "(uncaught errors: " + failure.browserErrors.length + " detected)";
      }

      var url = failure.url ? "[ " + failure.url + " ]" : "";
      return "  " + (i + 1) + ") " + failure.testName + " " + url + " " + browserErrorsNote;
    }).join("\n");

    var msg = "================ FAILURES in " + this.jobName + " " + this.buildDisplayName
      + " ================\n" + output + "\nBuild Log: " + this.buildURL;

    this.slack.notify(msg);
  }
};

Reporter.prototype._handleMessage = function (testRun, message) {
  if (message.type === "worker-status") {
    if (message.status === "finished") {

      // Remove any already-existing record of this test (i.e. assume a pass on this test).
      // Note: We could just keep and not add on re-fail, but then the sauceURL would be incorrect.
      this.failures = _.filter(this.failures, function (failure) {
        return failure.testName !== message.name;
      });

      if (!message.passed) {
        // If a test failed, add it to our list of failed tests. If we've removed a previous
        // run, THIS run will have the right sauceURL.
        var url = "";
        var browserErrors;
        if (message.metadata) {
          url = (message.metadata.sauceURL ? message.metadata.sauceURL : "")
            || message.metadata.buildURL;
          browserErrors = message.metadata.browserErrors;
        }
        this._addFailure(message.name, browserErrors, url);
      }
    }
  }
};

/*
* Creates a formatted line describing the test failure.
*
* failures[] is a list of test names that have failed.
*
* SauceLabs test failures include the Sauce URL look like this:
*  1) Smoke Scenario 6 [ https://saucelabs.com/tests/..... ]
*
* Non-Sauce test (i.e. PhantomJS) failures look like this:
*  1) Smoke Scenario 6
*
* */
Reporter.prototype._addFailure = function (testName, browserErrors, url) {
  this.failures.push({
    testName: testName,
    browserErrors: browserErrors,
    url: url
  });
};

module.exports = Reporter;
