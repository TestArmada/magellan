"use strict";

const fs = require("fs");

module.exports = (path) => {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
};
