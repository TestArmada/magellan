/*
  Fake testing for unit testing purposes
*/
var util = require("util");
var Q = require("q");
var _ = require("lodash");
// var path = require("path");
var BaseTestrun = require("../../test_run");

var FakeTestrun = function (options) {
  BaseTestrun.call(this, options);
};

util.inherits(FakeTestrun, BaseTestrun);

FakeTestrun.prototype.getCommand = function () {
  return "./test_support/fake_test.js";
};

FakeTestrun.prototype.getEnvironment = function (env) {
  return env;
};

FakeTestrun.prototype.getArguments = function () {
  return [this.path];
};

module.exports = FakeTestrun;
