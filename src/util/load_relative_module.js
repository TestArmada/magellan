"use strict";

const path = require("path");
const logger = require("../logger");

module.exports = (mPath, moduleIsOptional, opts) => {
  let resolvedRequire;
  mPath = mPath.trim();

  // hacky solution, cannot find a good way to mock it
  let inRequire = require;

  if (opts && opts.require) {
    inRequire = opts.require;
  }

  if (mPath.charAt(0) === ".") {
    resolvedRequire = path.resolve(process.cwd() + "/" + mPath);
  } else {
    resolvedRequire = mPath;
  }

  let RequiredModule;
  try {
    /*eslint global-require: 0*/
    RequiredModule = inRequire(resolvedRequire);
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

  return RequiredModule ? new RequiredModule() : null;
};
