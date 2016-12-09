"use strict";

var testFilter = require("./test_filter");
var settings = require("./settings");

module.exports = function (filters, opts) {
  var _settings = settings;
  /* istanbul ignore next */
  if (opts && opts.settings) {
    _settings = opts.settings;
  }

  var getTests = _settings.testFramework.iterator;
  var allFiles = getTests(_settings);

  return testFilter.filter(allFiles, filters, opts);
};
