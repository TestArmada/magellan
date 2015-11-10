var fs = require('fs');
var path = require('path');
var spawnSync = require('spawn-sync');

var reporter = path.resolve(__dirname, 'test_capture.js');
var mochaOpts = require('./mocha_settings').mochaOpts;

module.exports = function(settings) {
  var testOutputPath = path.resolve(settings.tempDir, 'get_mocha_tests.json');
  var cmd = './node_modules/.bin/mocha';
  var args = ['--reporter', reporter];
  if (mochaOpts) {
    args.push('--opts', mochaOpts);
  }

  process.env.MOCHA_CAPTURE_PATH = testOutputPath;
  var capture = spawnSync(cmd, args, {env: process.env});

  if (capture.status !== 0 || capture.stderr.toString()) {
    console.error('Could not capture mocha tests. To debug, run the following command:\nMOCHA_CAPTURE_PATH=%s %s %s', testOutputPath, cmd, args.join(' '));
    process.exit(1);
  }

  var tests = fs.readFileSync(testOutputPath, 'utf-8');
  fs.unlinkSync(testOutputPath);

  tests = JSON.parse(tests);
  tests.forEach(function(t) {
    t.toString = function() {
      return this.fullTitle;
    };
  });

  return tests;
};
