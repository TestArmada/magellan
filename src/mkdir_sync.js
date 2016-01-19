"use strict";

var fs = require("fs");

module.exports = function (path) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
};
