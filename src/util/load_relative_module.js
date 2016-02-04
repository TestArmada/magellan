"use strict";

var path = require("path");
var clc = require("cli-color");

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
      console.error(clc.redBright("Error loading a module from user configuration."));
      console.error(clc.redBright("Cannot find module: " + resolvedRequire));
      throw new Error(e);
    }
  }

  console.log(RequiredModule);

  return new RequiredModule();
};
