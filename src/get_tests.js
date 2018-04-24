"use strict";

const testFilter = require("./test_filter");
const settings = require("./settings");

module.exports = (filters, opts) => {

  const getTests = settings.testFramework.iterator;
  const allFiles = getTests(settings);

  return testFilter.filter(allFiles, filters, opts);
};
