"use strict";

var fs = require("fs");

module.exports = function (path, opts) {
  var _fs = fs;
  /* istanbul ignore next */
  if (opts && opts.fs) {
    _fs = opts.fs;
  }

  try {
    _fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
};
