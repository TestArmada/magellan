var margs = require("../../margs");
var argv = margs.argv;

module.exports = {
  mochaOpts: argv.mocha_opts, // --mocha_opts opts_file

  mochaTestFolders: argv.mocha_tests, // --mocha_tests location (or array in magellan.json)

  mochaAtom: argv.mocha_atom // --mocha_atom granularity to distribute per worker. possible values: browser, test
};
