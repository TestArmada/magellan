"use strict";

/*eslint-disable no-magic-numbers, no-bitwise*/

var guid = require("./util/guid");
var argv = require("marge").argv;
var env = process.env;
var fs = require("fs");
var path = require("path");

// Allow an external build id (eg: from CI system, for example) to be used. If we're not given one,
// we generate a random build id instead. NOTE: This build id must work as a part of a filename.
var buildId = argv.external_build_id || "magellan-" + guid();

// Create a temporary directory for child build assets like configuration, screenshots, etc.
var mkdirSync = require("./mkdir_sync");
var TEMP_DIR = path.resolve(argv.temp_dir || "./temp");

try {
  fs.accessSync(TEMP_DIR, fs.R_OK | fs.W_OK);
  console.log("Magellan is creating temporary files at: " + TEMP_DIR);
} catch (e) {
  throw new Error("Magellan cannot write to the temporary directory: " + TEMP_DIR);
}

mkdirSync(TEMP_DIR);

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

  // By default, kill time of long running tests is 8 minutes *only if bail options are set*
  // Otherwise bailTime is only explicitly used if explicitly set -- tests are otherwise allowed
  // to run "forever".
  bailTime: argv.bail_time || 8 * 60 * 1000,
  bailTimeExplicitlySet: typeof argv.bail_time !== "undefined",

  // For --bail_early, we have two settings:
  // threshold: the ratio (out of 1) of how many tests we need to see fail before we bail early.
  // min attempts: how many tests we need to see first before we apply the threshold
  bailThreshold: parseFloat(argv.early_bail_threshold) || 0.1,
  bailMinAttempts: parseInt(argv.early_bail_min_attempts) || 10,

  buildId: buildId,

  framework: argv.framework || "nightwatch",

  customSauceBrowsers: argv.customSauceBrowsers || []
};
