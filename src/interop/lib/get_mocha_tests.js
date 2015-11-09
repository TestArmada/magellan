var path = require('path');
var exec = require('sync-exec');

var reporter = path.resolve(__dirname, 'test_capture.js');
var mochaOpts = require('./mocha_settings').mochaOpts;

module.exports = function() {
  var cmd = './node_modules/.bin/mocha --reporter ' + reporter + ' --opts ' + mochaOpts;
  var capture = exec(cmd);

  if (capture.stderr) {
    console.error(capture.stderr);
    process.exit(1);
  }

  var tests = JSON.parse(capture.stdout);

  //tests.splice(1);
  tests.forEach(function(t) {
    t.toString = function() {
      return this.fullTitle;
    };
  });

  return tests;
};
