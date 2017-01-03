"use strict";

var path = require("path");
var clc = require("cli-color");
var _ = require("lodash");

module.exports = function (mPath, moduleIsOptional, opts) {
  var resolvedRequire;
  mPath = mPath.trim();

  var runOpts = _.assign({
    require: require,
    console: console
  }, opts);

  if (mPath.charAt(0) === ".") {
    resolvedRequire = path.resolve(process.cwd() + "/" + mPath);
  } else {
    resolvedRequire = mPath;
  }

  var RequiredModule;
  try {
    /*eslint global-require: 0*/
    RequiredModule = runOpts.require(resolvedRequire);
  } catch (e) {
    if (e.code === "MODULE_NOT_FOUND" && moduleIsOptional !== true) {
      runOpts.console.error(clc.redBright("Error loading a module from user configuration."));
      runOpts.console.error(clc.redBright("Cannot find module: " + resolvedRequire));
      throw new Error(e);
    } else if (e.code === "MODULE_NOT_FOUND" && moduleIsOptional === true) {
      // Do nothing
    } else {
      throw new Error(e);
    }
  }

  return RequiredModule ? new RequiredModule() : null;
};
