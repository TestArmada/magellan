"use strict";

const path = require("path");
const _ = require("lodash");
const yargs = require("yargs");
const logger = require("../logger");

module.exports = (mPath, moduleIsOptional, opts) => {
  let resolvedRequire;
  mPath = mPath.trim();

  const runOpts = _.assign({
    require
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
      logger.err("Error loading a module from user configuration.");
      logger.err("Cannot find module: " + resolvedRequire);
      throw new Error(e);
    } else if (e.code === "MODULE_NOT_FOUND" && moduleIsOptional === true) {
      // Do nothing
    } else {
      throw new Error(e);
    }
  }

  return RequiredModule ? new RequiredModule({ argv: yargs.argv }) : null;
};
