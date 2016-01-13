"use strict";

// Magellan Arguments:
//
// 1. Attempt to source arguments from magellan.json in the current working directory
//    Only throw an error if the file is *present*, but *malformed*.
// 2. Override or further define arguments from yargs.argv
//

var path = require("path");
var yargs = require("yargs");
var magellanConfigFilePath = yargs.argv.config || "./magellan.json";

var argv = {};

// First, collect arguments from a file if they exist.
var argsFromFile;
var filename = path.resolve(magellanConfigFilePath);

try {
  /*eslint-disable global-require*/
  argsFromFile = require(filename);
  console.log("Loaded magellan configuration from: ", filename);
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    // this is ok -- magellan.conf is not required to exist
    if (yargs.argv.debug || yargs.argv.config) {
      if (yargs.argv.config) {
        // If we specified this configuration path *explicitly*, fail
        console.log("Error loading Magellan configuration from: " + filename);
        process.exit(1);
      } else {
        // We're just trying the default location and it's not required, so only print a
        // warning (in debug mode)
        console.log("No magellan configuration found. Tried path:");
        console.log(filename);
      }
    }
  } else {
    console.log("Error loading Magellan configuration from: " + filename);
    console.log(e);
    process.exit(1);
  }
}

if (argsFromFile && typeof argsFromFile === "object") {
  Object.keys(argsFromFile).forEach(function (key) {
    argv[key] = argsFromFile[key];
  });
}

// Second, collect overriding arguments from process.argv.
Object.keys(yargs.argv).forEach(function (key) {
  if (key.indexOf("$") === 0 || key === "_") {
    // Ignore these keys
  } else {
    argv[key] = yargs.argv[key];
  }
});

if (argv.debug) {
  console.log("Magellan arguments: ", argv);
}

module.exports = {
  argv: argv
};
