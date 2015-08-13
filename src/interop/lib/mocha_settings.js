var margs = require("../../margs");
var argv = margs.argv;

module.exports = {
  mochaOpts: argv.mocha_opts, // --mocha_opts opts_file

  mochaTestFolders: argv.mocha_tests, // --mocha_tests location (or array in magellan.json)

  // TODO: deprecate and make this the responsibility of the test suite itself
  appiumApplicationLocation: argv.appium_application_location
};