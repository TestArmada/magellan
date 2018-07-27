"use strict";

const TEST_STATUS_NEW = 1;
const TEST_STATUS_FAILED = 2;
const TEST_STATUS_SUCCESSFUL = 3;
const TEST_STATUS_SKIPPED = 4;

class Test {
  constructor(locator, profile, executor, maxAttempts) {
    //
    // note: this locator object is an instance of an object which is defined by whichever test
    // framework plugin is currently loaded. The implementation of locator could be almost any
    // shape, and the only duck type strictly required by magellan is that toString() is defined
    //
    this.locator = locator;

    this.maxAttempts = maxAttempts;
    this.maxResourceAttempts = 10;

    this.attempts = 0;
    this.resourceAttempts = 0;
    this.status = TEST_STATUS_NEW;

    this.profile = profile;
    this.executor = executor;

    this.workerIndex = -1;
    this.error = undefined;
    this.stdout = "";
    this.stderr = "";
  }

  // Return true if we've either:
  //   1. passed this test, OR
  //   2. failed this test too many times
  canRun() {
    const canRetry = this.status === TEST_STATUS_FAILED && this.attempts < this.maxAttempts;
    const isNew = this.status === TEST_STATUS_NEW;
    return !isNew && !canRetry;
  }

  pass() {
    this.attempts++;
    this.status = TEST_STATUS_SUCCESSFUL;
  }

  fail(attempts) {
    this.attempts = attempts;
    this.status = TEST_STATUS_FAILED;
  }

  startClock() {
    this.runningTime = undefined;
    this.startTime = (new Date()).getTime();
  }

  stopClock() {
    this.runningTime = (new Date()).getTime() - this.startTime;
  }

  // return an unambiguous representation of this test: path, profile information
  toString() {
    return this.locator.toString() + " @" + this.profile.toString();
  }

  getRuntime() {
    if (this.runningTime) {
      return this.runningTime;
    } else {
      return (new Date()).getTime() - this.startTime;
    }
  }

  getRetries() {
    return this.attempts - 1;
  }
}

Test.TEST_STATUS_NEW = TEST_STATUS_NEW;
Test.TEST_STATUS_FAILED = TEST_STATUS_FAILED;
Test.TEST_STATUS_SUCCESSFUL = TEST_STATUS_SUCCESSFUL;
Test.TEST_STATUS_SKIPPED = TEST_STATUS_SKIPPED;

module.exports = Test;
