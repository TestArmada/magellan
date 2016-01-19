"use strict";

var TEST_STATUS_NEW = 1;
var TEST_STATUS_FAILED = 2;
var TEST_STATUS_SUCCESSFUL = 3;
var TEST_STATUS_PENDING = 4;

function Test(locator, browser, sauceBrowserSettings, maxAttempts) {
  this.locator = locator;
  this.maxAttempts = maxAttempts;

  this.attempts = 0;
  this.status = TEST_STATUS_NEW;

  this.browser = browser;

  this.workerIndex = -1;
  this.error = undefined;
  this.stdout = "";
  this.stderr = "";

  this.sauceBrowserSettings = sauceBrowserSettings;
}

// Return true if we've either:
//   1. passed this test, OR
//   2. failed this test too many times
Test.prototype.canRun = function () {
  var canRetry = this.status === TEST_STATUS_FAILED && this.attempts < this.maxAttempts;
  var isNew = this.status === TEST_STATUS_NEW;
  return !isNew && !canRetry;
};

Test.prototype.pass = function () {
  this.attempts++;
  this.status = TEST_STATUS_SUCCESSFUL;
};

Test.prototype.fail = function () {
  this.attempts++;
  this.status = TEST_STATUS_FAILED;
};

Test.prototype.pending = function () {
  this.status = TEST_STATUS_PENDING;
};

Test.prototype.startClock = function () {
  this.runningTime = undefined;
  this.startTime = (new Date()).getTime();
};

Test.prototype.stopClock = function () {
  this.runningTime = (new Date()).getTime() - this.startTime;
};

// return an unambiguous representation of this test: path, browserId, resolution, orientation
Test.prototype.toString = function () {
  return this.locator.toString() + " @" + this.browser.browserId
    + " " + (this.browser.resolution ? "res:" + this.browser.resolution : "")
    + (this.browser.orientation ? "orientation:" + this.browser.orientation : "");
};

Test.prototype.getRuntime = function () {
  if (this.runningTime) {
    return this.runningTime;
  } else {
    return (new Date()).getTime() - this.startTime;
  }
};

Test.TEST_STATUS_NEW = TEST_STATUS_NEW;
Test.TEST_STATUS_FAILED = TEST_STATUS_FAILED;
Test.TEST_STATUS_SUCCESSFUL = TEST_STATUS_SUCCESSFUL;
Test.TEST_STATUS_PENDING = TEST_STATUS_PENDING;

module.exports = Test;
