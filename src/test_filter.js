"use strict";

var _ = require("lodash");
var settings = require("./settings");

module.exports = {

  // Detect and return filters specified by command line arguments
  // from an argv object args
  detectFromCLI: function (args, opts) {
    var _settings = settings;
    /* istanbul ignore next */
    if (opts && opts.settings) {
      _settings = opts.settings;
    }

    var filters = {};

    _.keys(_settings.testFramework.filters).forEach(function (f) {
      if (args[f]) {
        filters[f] = args[f];
      }
    });

    return filters;
  },

  // Successively reduce files to a smaller set of files by
  // running a list of filters on the list repeatedly
  filter: function (files, filters, opts) {
    var _settings = settings;
    /* istanbul ignore next */
    if (opts && opts.settings) {
      _settings = opts.settings;
    }

    var allFiles = files;

    _.forEach(filters, function (n, k) {
      if (_settings.testFramework.filters[k]) {
        // if we have this filter predefined in settings.js
        // do filter here
        allFiles = _settings.testFramework.filters[k](allFiles, filters[k]);
      }
    });

    return allFiles;
  }

};
