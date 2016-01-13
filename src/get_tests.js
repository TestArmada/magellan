"use strict";

var testFilter = require("./test_filter");
var settings = require("./settings");

module.exports = function (filters) {
  var getTests = settings.testFramework.iterator;
  var allFiles = getTests();

  return testFilter.filter(allFiles, filters);
};
