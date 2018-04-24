"use strict";

const _ = require("lodash");
const settings = require("./settings");

module.exports = {
  // Detect and return filters specified by command line arguments
  // from an argv object args
  detectFromCLI: (args, opts) => {

    const filters = {};

    _.keys(settings.testFramework.filters).forEach((f) => {
      if (args[f]) {
        filters[f] = args[f];
      }
    });

    return filters;
  },

  // Successively reduce files to a smaller set of files by
  // running a list of filters on the list repeatedly
  filter: (files, filters, opts) => {

    let allFiles = files;

    _.forEach(filters, (n, k) => {
      if (settings.testFramework.filters[k]) {
        // if we have this filter predefined in settings.js
        // do filter here
        allFiles = settings.testFramework.filters[k](allFiles, filters[k]);
      }
    });

    return allFiles;
  }
};
