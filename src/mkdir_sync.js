"use strict";

var fs = require("fs");
var _ = require("lodash");

module.exports = function (path, opts) {
  var runOpts = _.assign({
    fs: fs
  }, opts);

  try {
    runOpts.fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
};
