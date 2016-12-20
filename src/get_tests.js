"use strict";

var _ = require("lodash");

var testFilter = require("./test_filter");
var settings = require("./settings");

module.exports = function (filters, opts) {
  var runOpts = _.assign({
    settings: settings
  }, opts);

  var getTests = runOpts.settings.testFramework.iterator;
  var allFiles = getTests(runOpts.settings);

  return testFilter.filter(allFiles, filters, opts);
};
