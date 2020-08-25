/*
  Fake testing for unit testing purposes
*/
const _ = require("lodash");

const FakeTestrun = function (options) {
  _.extend(this, options);
};

FakeTestrun.prototype.getCommand = function () {
  return "./test_support/fake_test.js";
};

FakeTestrun.prototype.getEnvironment = function (env) {
  return env;
};

FakeTestrun.prototype.getArguments = function () {
  return [this.locator.toString()];
};

module.exports = FakeTestrun;
