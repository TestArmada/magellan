var path = require('path');
var exec = require('sync-exec');

var reporter = path.resolve(__dirname, 'test_capture.js');
var mochaSettings = require('./mocha_settings');
var mochaOpts = mochaSettings.mochaOpts;
var mochaAtom = mochaSettings.mochaAtom;

module.exports = function() {
  var cmd = 'mocha --reporter ' + reporter + ' --opts ' + mochaOpts;
  var capture = exec(cmd);

  if (capture.stderr) {
    console.error(capture.stderr);
    process.exit(1);
  }

  var tests = JSON.parse(capture.stdout);
  return tests;
};
