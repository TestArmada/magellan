var path = require("path"),
  fs = require("fs"),
  _ = require("lodash"),
  clc = require("cli-color"),
  settings = require("./settings");

module.exports = {

  // Detect and return filters specified by command line arguments
  // from an argv object args
  detectFromCLI: function (args) {
    var filters = {};

    _.keys(settings.testFramework.filters).forEach(function (f) {
      if (args[f]) {
        filters[f] = args[f];
      }
    });

    return filters;
  },

  // Successively reduce files to a smaller set of files by
  // running a list of filters on the list repeatedly
  filter: function(files, filters) {
    var allFiles = files;

    _.forEach(filters, function(n, k) {
      if (settings.testFramework.filters[k]) {
        // if we have this filter predefined in settings.js
        // do filter here
        allFiles = settings.testFramework.filters[k](allFiles, filters[k]);
      }
    });

    return allFiles;
  }

};