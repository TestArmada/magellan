"use strict";

var path = require("path");

module.exports = function (mPath) {
  var resolvedRequire;
  mPath = mPath.trim();

  if (mPath.charAt(0) === ".") {
    resolvedRequire = path.resolve(process.cwd() + "/" + mPath);
  } else {
    resolvedRequire = mPath;
  }

  var RequiredModule;
  try {
    /*eslint global-require: 0*/
    RequiredModule = require(resolvedRequire);
  } catch (e) {
    if (e.code === "MODULE_NOT_FOUND") {
      console.error("Error while loading a module from configuration: " + resolvedRequire);
      console.error(e);
      process.exit(1);
    }
  }

  return new RequiredModule();
};
