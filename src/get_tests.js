"use strict";

const _ = require("lodash");

const testFilter = require("./test_filter");
const settings = require("./settings");

module.exports = (filters, opts) => {
  const runOpts = _.assign({
    settings
  }, opts);

  const getTests = runOpts.settings.testFramework.iterator;
  const allFiles = getTests(runOpts.settings);

  return testFilter.filter(allFiles, filters, opts);
};
