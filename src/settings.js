var fs = require("fs");
var margs = require("./margs");
var argv = margs.argv;
var env = process.env;

// Allow an external build id (eg: from CI system, for example) to be used. If we're not given one,
// we generate a random build id instead. NOTE: This build id must work as a part of a filename.
var buildId = argv.external_build_id || "magellan-" + Math.round(Math.random() * 9999999999).toString(16);

// Create a temporary directory for temporary child build assets like configuration, screenshots, etc.
var mkdirSync = require("./mkdir_sync");
var TEMP_DIR = "./temp";
var path = require("path");
mkdirSync(path.resolve(TEMP_DIR));

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

  buildId: buildId,

  framework: argv.framework || "magellan-nightwatch",

  // TODO: move this to interop
  // Default to a config location that is the same as the magellan-boilerplate
  nightwatchConfigFilePath: argv.nightwatch_config || (fs.existsSync("./nightwatch.json") ? "./nightwatch.json" : "./conf/nightwatch.json"),

  customSauceBrowsers: argv.customSauceBrowsers || []
};