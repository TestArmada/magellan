# magellan
## Large-Scale Automated Testing

Magellan is a tool for massively-scaling your automated test suite, with added reliability. Run large test suites across across many environments (multiple browsers or versions, or multiple native iOS or Android devices) at the same time, in parallel, with a friendly command-line workflow that is both local development and continuous-integration friendly. Magellan is compatible with `mocha` (`wd.js`, `webdriver.io`, `appium`, and node.js) tests ( [example Mocha/wd project](https://github.com/TestArmada/boilerplate-mocha) ) and `Nightwatch.js` tests ( [example Nightwatch project](https://github.com/TestArmada/boilerplate-nightwatch) ), and includes [SauceLabs](http://www.saucelabs.com/) support.

Features:

  - **Parallel Test Runs**
    - Worker allocation and management with failed test retry.
    - Network port management and testing, with isolated ports for mocking servers, individual (per-worker) selenium servers.
    - Configurable worker count.
    - Testing and debugging workflows. Run many tests at once, one test at a time, filter by tags, groups, etc.
    - Suite run control: Bail likely-failing suite runs early, or bail upon first failure.
    - Run many different parallel **local** browsers (eg: Chrome, Firefox, etc) all at the same time.
    - Run many different parallel **remote** (SauceLabs) browsers.
  - **Integration Support**
    - Status reporter API with events streamed from workers, with some included reporters.
    - Slack reporting support.
    - [Admiral](https://github.com/TestArmada/admiral) reporting support.
    - Plays well with CI (Jenkins, etc).
    - SauceLabs Remote Browser Support:
      - Optional tunnel management.
      - Create lists of browser tiers or browser testing groups with browser profiles (eg: tier1 browsers, tier2 browsers, mobile browsers, vintage IE versions, etc).

Test Framework Compatibility
============================

  - `mocha` / `wd` / `webdriver.io` [example Mocha/wd project](https://github.com/TestArmada/boilerplate-mocha)
  - `node.js` (non-browser) test suites (example project coming soon).
  - `Nightwatch.js` test suites ( [example Nightwatch project](https://github.com/TestArmada/boilerplate-nightwatch).
  - `appium.js` (example project coming soon).

Example Developer Workflows
===========================

**Note**: The following examples assume you have `./node_modules/.bin` in your `PATH`. If you don't have this rule in `PATH`, or are unable to add it, you can also run any of the examples below like this:
```console
$ ./node_modules/.bin/magellan
```

Quick Reference Guide for Command-Line Use
==========================================

#### Running Many Tests in Parallel (Default)

By default, `magellan` will try to run your the fastest way possible, in parallel, in the `phantomjs` browser.

To execute your tests, run:
```console
$ magellan
```

You can also run parallel tests on a real local browser:
```console
# launch several instances of Chrome at once and run tests in parallel
$ magellan --browser=chrome

# launch several instances of Firefox at once and run tests in parallel
$ magellan --browser=firefox
```

#### Testing in Multiple Browsers

`magellan` can run your test suite across multiple browsers with one command:
```console
# Run tests locally in both PhantomJS and Chrome
$ magellan --browser=chrome,phantomjs

# Run tests locally in Chrome and Firefox
$ magellan --browser=chrome,firefox
```

#### Controlling Which Tests Run

To filter by one or more tags, run `magellan` with the `--tag` or `--tags` option:
```console
# Specify one tag:
$ magellan --tag=customer

# Specify multiple tags:
$ magellan --tags=customer,guest
```

To limit the your tests by a file path prefix, use the `--group` option:
```console
$ magellan --group=tests/Smoke
```
The above filter will match `tests/product/tests/Smoke*`

Filter options can be combined together. For example, `--tags` and `--group` work together:
```console
$ magellan --group=tests/Smoke --tags=customer,guest
```

To run **one specific test**, use the `--test` flag with a path to the test file:
```console
$ magellan --test=path/to/my/test.js
```

#### Running Tests One at a Time (Serial Mode)

You can run your entire suite serially (i.e. one at a time) and get live console output with the `--serial` option:
```console
$ magellan --serial
```

Note that `--serial` can be combined with `--tag`, `--group` and `--test` filters, as well as different `--browser` options.

#### Early Test Run Termination

Test suites that have one or more failing tests can be terminated faster to conserve resource usage (i.e. in CI) or obtain results on failing tests faster (i.e. during a developer workflow).

To terminate a run early as soon as any test has failed, use `--bail_fast`:
```console
$ magellan --bail_fast
```

To terminate a run early if 10% of total test runs have failed (and at least 10 test runs have occurred), use `--bail_early`.
```console
$ magellan --bail_early
```
This option allows for a build to run for longer but still terminate if a significant portion of the suite is failing. Use this option if you want to avoid running a long test run, but want to be able to potentially spot trends in failing tests.

You can control how long Magellan waits for a test to execute before explicitly killing it by supplying a `bail_time` argument. For example, to set bail time to 60 seconds:
```console
$ magellan --bail_early --bail-time=60000
```

A bail option does not have to be used to set bail time. For example:
```console
$ magellan --bail-time=60000
```

The `bail_time` setting can also be written to Magellan configuration. See 

Saving Configuration
====================

To use the same arguments on every `magellan` run, create a file called `magellan.json` and use the same arguments as `magellan` takes, but in JSON format. For example:

```json
{
  "bail_fast": true,
  "max_workers": 5
}
```

To supply a path to a different magellan configuration file, use the `--config` argument:

```console
$ magellan --config=./alternate_config.json
```

Custom Reporters
================

Magellan supports custom reporters. A custom reporter is a module that inherits from Magellan's base reporter class and can listen to a number of events and streams for monitoring test activity.

Adding Custom Reporters
=======================

To include a custom reporter, add it to `magellan.json` like this:

```json
{
  "bail_fast": true,
  "max_workers": 5,
  "reporters": [
    "./path/to/my/reporter",
    "my_reporter_module"
  ]
}
```

In the example above, `./path/to/my/reporter` refers to a module in your test suite directory tree, whereas `my_reporter_module` is a module you have included in `package.json`

Example Custom Reporter
=======================

```javascript
var BaseReporter = require("magellan").Reporter;
var util = require("util");

var Reporter = function () {
};

util.inherits(Reporter, BaseReporter);

Reporter.prototype.listenTo = function (testRun, source) {
  // Stream stdout and stderr directly to stdout, assuming this source is
  // a process that has those properties.
  if (source.stdout) {
    source.stdout.pipe(process.stdout);
  }
  if (source.stderr) {
    source.stderr.pipe(process.stderr);
  }
};

module.exports = Reporter;
```

When magellan is preparing a test run, it will call your reporter's implementation of `listenTo()`. Arguments are as follows:

  - `source` is a node event emitter that optionally has properties `stdout` and `stderr`.
  - `testRun` is an object with information about the specific test run this source is associated with. It has the following properties:
    - `path`: The filesystem path to the actual test file. Useful as an identifier for a test.
    - `buildId`: The id of the whole **suite** run.
    - `tempAssetPath`: The path to place various temporary assets (logs, screenshots, configuration files, etc) generated by or for a specific **test** run.

Reporter Events
===============

At the moment, there is one event available, `worker-status`, which indicates whether a Magellan worker has started executing a test or finished executing a test. The example below illustrates how to unpack this event:

```javascript
source.on("message", function (msg) {
  if (msg.type === "worker-status") {
    if (msg.status === "started") {
      console.log("Test started: " + msg.name);
    } else if (msg.status === "finished") {
      console.log("Test finished: " + msg.name);
      console.log("    Pass/fail: " + msg.passed);
    }
  }
});
```

Asynchronous Reporter Initialization
====================================

Some custom reporters need to initialize themselves asynchronously before `listenTo` can be called. To do this, the a reporter class can define an `initialize()` method, and return a [Q](https://github.com/kriskowal/q) promise:

```javascript
  initialize: function () {
    var self = this;
    var deferred = Q.defer();

    console.log("Initializing reporter..");

    createJob(function(err, jobId) {
      if (err) {
        deferred.reject(err);
      } else {
        self.jobId = jobId;
        deferred.resolve();
      }
    });

    return deferred.promise;
  },
```

In the above example, a reporter needs to create a job entry and obtain the id of the job before it can send information about running tests. Magellan will wait until `initialize()` resolves this promise before starting any tests.

SauceLabs Support
=================

Magellan supports running tests through SauceLabs remote browsers. To do this, the following environment variables should be set:

```shell
# Set SauceLabs Credentials
export SAUCE_USERNAME='xxxxxxxxxx'
export SAUCE_ACCESS_KEY='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

# Set Secure Tunnel Settings

# SauceConnect version for download
export SAUCE_CONNECT_VERSION=4.3.10

# Tunnel id prefix, Example: "my_tunnel", "qa_tunnel", etc
export SAUCE_TUNNEL_ID="xxxxxxxxx"
```

SauceLabs Tunnelling Support (Sauce Connect)
============================================

**NOTE**: By default, Magellan assumes that tests run within a secure network and that a tunnel is required from SauceLabs to your test machine. If you don't need this option and want faster `--sauce` initialization, you can use `--no_tunnels` at runtime to skip the tunnel construction process.

Display Resolution and Orientation Support (SauceLabs Browsers)
===============================================================

To ensure that the SauceLabs display being used has enough resolution to support a given browser window size, use the `--resolution` option:

Single Sauce browser:
```console
$ magellan --sauce --browser=chrome_42_Windows_2012_R2_Desktop --resolution=1024x768
```

Multiple Sauce browsers:
```console
$ magellan --sauce --browsers=chrome_42_Windows_2012_R2_Desktop,safari_7_OS_X_10_9_Desktop --resolution=1024x768
```

In this case, `1024x768` is selected for `chrome_42_Windows_2012_R2_Desktop` and `safari_7_OS_X_10_9_Desktop`. If this resolution isn't available in all Sauce browser environments specified, Magellan will return an error.

For Sauce devices that support it, orientation is also supported with the `--orientation` option:

```console
$ magellan --sauce --browser=iphone_8_2_iOS_iPhone_Simulator --orientation=landscape
```

Sometimes it's useful to specify a list of environments with differing resolutions or orientations. For this case, Magellan supports profiles stored in `magellan.json`:

```json
{
  "profiles": {
    "my_profile_1": [
      { "browser": "chrome_42_Windows_2012_R2_Desktop", "resolution": "2560x1600" },
      { "browser": "chrome_42_Windows_2012_R2_Desktop", "resolution": "800x600" },
      { "browser": "ipad_8_2_iOS_iPad_Simulator", "orientation": "landscape" },
      { "browser": "ipad_8_2_iOS_iPad_Simulator", "orientation": "portrait" },
      { "browser": "iphone_8_2_iOS_iPhone_Simulator", "orientation": "portrait" }
    ],
    "tier_2_browsers": [
      { "browser": "safari_7_OS_X_10_9_Desktop" },
      { "browser": "IE_8_Windows_2008_Desktop" },
      { "browser": "IE_9_Windows_2008_Desktop" }
    ]
  }
```

Notice that `resolution` and `orientation` are optional. Multiple definitions of the same browser running in different resolutions or orientations are permitted. To select these profiles, we call:

```console
$ magellan --profile=tier_2_browsers
# or
$ magellan --profile=my_profile_1
# or specify multiple profiles
$ magellan --profile=tier_1_browsers,tier_2_browsers
```

Setting Up Setup and Teardown Tasks for CI
==========================================

If you have setup and teardown tasks that need to run before and after `magellan` is called (for compilation, standing up a mocking server, cleanup, etc), then you can expose the following npm task flow using the `scripts` example below:
```console
$ npm run magellan:setup
$ magellan
$ npm run magellan:teardown
```

and:
```console
$ npm run magellan:setup
$ magellan --sauce
$ npm run magellan:teardown
```

Here's an example `scripts` block that implements these tasks in your package.json:
```json
  "scripts": {
    "magellan:setup": "./path/to/my/setup.sh",
    "magellan:teardown": "./path/to/my/teardown.sh"
  },
```

## Licenses

All code not otherwise specified is Copyright Wal-Mart Stores, Inc.
Released under the [MIT](./LICENSE) License.
