"use strict";

var path = require("path");
var clc = require("cli-color");

module.exports = function (mPath, moduleIsOptional, opts) {
  var resolvedRequire;
  mPath = mPath.trim();

  var _require = require;
  /* istanbul ignore next */
  if (opts && opts.require) {
    _require = opts.require;
  }

  var _console = console;
  /* istanbul ignore next */
  if (opts && opts.console) {
    _console = opts.console;
  }

  if (mPath.charAt(0) === ".") {
    resolvedRequire = path.resolve(process.cwd() + "/" + mPath);
  } else {
    resolvedRequire = mPath;
  }

  var RequiredModule;
  try {
    /*eslint global-require: 0*/
    RequiredModule = _require(resolvedRequire);
  } catch (e) {
    if (e.code === "MODULE_NOT_FOUND" && moduleIsOptional !== true) {
      _console.error(clc.redBright("Error loading a module from user configuration."));
      _console.error(clc.redBright("Cannot find module: " + resolvedRequire));
      throw new Error(e);
    }
  }

  return RequiredModule ? new RequiredModule() : null;
};
