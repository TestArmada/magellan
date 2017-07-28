"use strict";

/*eslint-disable no-magic-numbers, no-bitwise, no-console */

const guid = require("./util/guid");
const argv = require("marge").argv;
const env = process.env;
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

// Allow an external build id (eg: from CI system, for example) to be used. If we're not given one,
// we generate a random build id instead. NOTE: This build id must work as a part of a filename.
// NOTE: The result of this line is that buildId is truthy so toString() should work
const buildId = (argv.external_build_id || "magellan-" + guid()).toString();

// Create a temporary directory for child build assets like configuration, screenshots, etc.
const mkdirSync = require("./mkdir_sync");
const TEMP_DIR = path.resolve(argv.temp_dir || "./temp");

try {
  // Check if TEMP_DIR already exists.
  // NOTE: This doesn't work in node 0.10. Those envs will suffer as a result
  /* istanbul ignore else */
  if (fs.accessSync) {
    fs.accessSync(TEMP_DIR, fs.R_OK | fs.W_OK);
  } else {
    throw new Error("old node version");
  }
} catch (e) {
  // Create it if it doesn't..
  /* istanbul ignore next */
  mkdirSync(TEMP_DIR);
}

try {
  // Check if creation worked or if we have access to the directory we were told to use.
  // NOTE: This doesn't work in node 0.10. Those envs will suffer as a result
  // if we don't have accessSync, then we proceed without being sure about TEMP_DIR.
  // A crash will occur LATER in old node versions
  if (fs.accessSync) {
    fs.accessSync(TEMP_DIR, fs.R_OK | fs.W_OK);
  }
  logger.log("Magellan is creating temporary files at: " + TEMP_DIR);
} catch (e) {
  /* istanbul ignore next */
  throw new Error("Magellan cannot write to or create the temporary directory: " + TEMP_DIR);
}

const testTimeout =
  argv.test_timeout ? argv.test_timeout
    // --------------------
    // ALERT!!!!! Will be deprecated in next release
    //
    // backward compatible
    : argv.bail_time ? argv.bail_time : 8 * 60 * 1000;
    // --------------------

module.exports = {

  // Port allocation scheme:
  // - All port allocation starts at BASE_PORT_START
  // - Magellan gets a block of ports offset from the start BASE_PORT_RANGE wide
  // - Each worker instance gets BASE_PORT_SPACING ports to use
  //
  //           [...........[0,1,2][0,1,2]...............]
  //            ^ start                ^ spacing (eg: 3)
  //            ---------------- range -----------------
  //
  BASE_PORT_START: parseInt(argv.base_port_start) || 12000,
  BASE_PORT_RANGE: parseInt(argv.base_port_range) || 2000,
  BASE_PORT_SPACING: parseInt(argv.base_port_spacing) || 3,

  environment: env,

  debug: argv.debug,

  gatherTrends: argv.gather_trends,

  aggregateScreenshots: argv.aggregate_screenshots,
  tempDir: TEMP_DIR,

  testTimeout,

  buildId,

  framework: argv.framework || "nightwatch",

  customSauceBrowsers: argv.customSauceBrowsers || []
};
