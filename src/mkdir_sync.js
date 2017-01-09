"use strict";

const fs = require("fs");
const _ = require("lodash");

module.exports = (path, opts) => {
  const runOpts = _.assign({
    fs
  }, opts);

  try {
    runOpts.fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
};
