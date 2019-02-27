"use strict";

const fs = require("fs-extra");

module.exports = (path) => {
  try {
    fs.ensureDirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
};
