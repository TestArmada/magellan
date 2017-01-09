"use strict";

const path = require("path");
const clc = require("cli-color");
const _ = require("lodash");

module.exports = (mPath, moduleIsOptional, opts) => {
  let resolvedRequire;
  mPath = mPath.trim();

  const runOpts = _.assign({
    require,
    console
  }, opts);

  if (mPath.charAt(0) === ".") {
    resolvedRequire = path.resolve(process.cwd() + "/" + mPath);
  } else {
    resolvedRequire = mPath;
  }

  let RequiredModule;
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
