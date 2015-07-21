var fs = require("fs");
var path  = require("path");
var testFilter = require("./test_filter");
var settings = require("./settings");

module.exports = function (filters) {
  var getTests = require("./interop/" + settings.framework + "/get_tests");
  var allFiles = getTests();

  return testFilter.filter(allFiles, filters);
};