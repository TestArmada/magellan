## Magellan: Large-Scale Automated Testing

[![Build Status](https://travis-ci.org/TestArmada/magellan.svg?branch=master)](https://travis-ci.org/TestArmada/magellan)

![image](https://cloud.githubusercontent.com/assets/12995/9419235/e2fbb4f2-480e-11e5-9de8-c6c4871890b9.png)

Magellan is a tool for massively-scaling your automated test suite, with added reliability. Run large test suites across many environments (multiple browsers or versions, or multiple native iOS or Android devices) at the same time, in parallel, with a friendly command-line workflow that is both local development and continuous-integration friendly. Magellan is compatible with `mocha` (`wd.js`, `webdriver.io`, `appium`) tests ( [example Mocha/wd project](https://github.com/TestArmada/boilerplate-mocha) ) and `Nightwatch.js` tests ( [example Nightwatch project](https://github.com/TestArmada/boilerplate-nightwatch) ), and includes [SauceLabs](http://www.saucelabs.com/) support. Through Magellan's `mocha` support, you can scale regular node.js test suites too.

Features
========

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
    - SauceLabs Remote Browser and Device Support:
      - Optional Sauce Connect tunnel management (`--create_tunnels`).
      - Create lists of browser tiers or browser testing groups with browser profiles (eg: tier1 browsers, tier2 browsers, mobile browsers, vintage IE versions, etc).
      - Manage not just browsers, but also devices for native application testing (iOS and Android)
    - Can talk to a [locks service](https://github.com/TestArmada/locks) to control saucelabs virtual machine usage (beta).

Test Framework Compatibility and Installation
=============================================

Magellan supports test frameworks like Mocha and Nightwatch via the usage of **plugins**.

#### Mocha

Plugin:
  - https://github.com/TestArmada/magellan-mocha-plugin

Boilerplate / example projects:

  - `wd` ( [example Mocha/wd project](https://github.com/TestArmada/boilerplate-mocha-wd) )
  - `webdriver.io` ( [example Mocha/webdriver.io project](https://github.com/TestArmada/boilerplate-mocha-webdriverio) )
  - `node.js` test suites - see `magellan`'s own test suite
  - `appium.js` - example project coming soon.

Installation:

```shell
npm install --save testarmada-magellan
npm install --save testarmada-magellan-mocha-plugin
```

`magellan.json`
```json
{
  "framework": "testarmada-magellan-mocha-plugin"
}
```

#### Nightwatch

Plugin:
  - https://github.com/TestArmada/magellan-nightwatch-plugin

Boilerplate / example project:
  - `Nightwatch.js` ( [example Nightwatch project](https://github.com/TestArmada/boilerplate-nightwatch) )

Helper Library: (note: this is not required for nightwatch support)
  - https://github.com/TestArmada/magellan-nightwatch

Installation:

```shell
npm install --save testarmada-magellan
npm install --save testarmada-magellan-nightwatch-plugin
```

`magellan.json`
```json
{
  "framework": "testarmada-magellan-nightwatch-plugin"
}
```

How Magellan Fits In
====================

Magellan can best be described as a *runner-runner*. If you use `mocha` or `nightwatch` to run your current tests, then you can use Magellan to in turn run `mocha` or `nightwatch` and scale up your test runs.

When running tests with mocha, Magellan simply stacks on top of your existing suite:

#### `mocha` tests

![magellan stack-mocha](https://cloud.githubusercontent.com/assets/12995/9394790/552d3828-473f-11e5-9bb4-9d732f09c85b.png)

#### `mocha` tests, with help from `rowdy`

Note: **This is the preferred solution for working with `mocha`**. If you want to spend less time handling selenium `desiredCapabilities` objects and starting/stopping Selenium, Magellan works much better with [`rowdy`](https://github.com/FormidableLabs/rowdy), which handles these tasks for you (for examples of this in action, see our [example Mocha/wd project](https://github.com/TestArmada/boilerplate-mocha-wd) and [example Mocha/webdriver.io project](https://github.com/TestArmada/boilerplate-mocha-webdriverio)). That setup looks like this:

![magellan stack-rowdy](https://cloud.githubusercontent.com/assets/12995/9394793/554f1862-473f-11e5-80d8-450d95cacc66.png)

#### `Nightwatch.js` tests

Magellan can also run [`Nightwatch.js`](https://nightwatchjs.org/) test suites (please see our [example Nightwatch project](https://github.com/TestArmada/boilerplate-nightwatch) ), in which case your stack looks like this:

![magellan stack-nightwatch](https://cloud.githubusercontent.com/assets/12995/9394791/55493e24-473f-11e5-8f37-77d6683290f1.png)

#### Plain `node.js` tests

Finally, Magellan can also scale regular ol' node.js tests (no browsers or devices) using Mocha:

![magellan stack-nodejs](https://cloud.githubusercontent.com/assets/12995/9394792/554da8ba-473f-11e5-90fb-aeaed90be971.png)

Example Developer Workflows
===========================

Magellan is a command line tool.

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

##### Tag Support in Mocha-based Tests

In Mocha-based tests, Magellan will find tags in `it()` strings in the form of a tagname preceded by an `@`. For example, to define a test that would match with `--tags=commerce` or `--tags=smoke`, we would write:

```javascript
it("should submit the purchase @commerce @smoke", function (done) {
  ...
});
```

##### Tag Support in Nightwatch.js-based Tests

In Nightwatch-based tests, Magellan supports the standard Nightwatch convention of tags. To define a test that Magellan can match with `--tags=commerce` or `--tags=smoke`, we would write:

```javascript
module.exports = new Test({

  tags: ["commerce", "smoke"],

  "Load the order page": function (client) {
    ...
  },

  "Submit the purchase": function (client) {
    ...
  }

});
```

##### Selecting Tags at Runtime

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
$ magellan --bail_early --bail_time=60000
```

A bail option does not have to be used to set bail time. For example:
```console
$ magellan --bail_time=60000
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
var BaseReporter = require("testarmada-magellan").Reporter;
var util = require("util");

var Reporter = function () {
};

util.inherits(Reporter, BaseReporter);

Reporter.prototype.listenTo = function (testRun, test, source) {
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
  - `test` is the actual test being run. This contains information about how long the test has been running or already took to run, as well as how many attempts have been made on this test already.
  - `testRun` is an object with information about the specific test run this source is associated with. It has the following properties:
    - `locator`: An object describing the identity of the test, whether it be filename or name (*note: the uniqueness of the test is often a composition of locator properties, because a test with a given name might live in a given file, and that name might not uniquely identify it across an entire suite*). This object is guaranteed to have a `toString()` function which returns a human readable representation of the identity of the test, but is not guaranteed to have any other properties.
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

Optional Reporter Loading
=========================

Your project may have reporter modules that you only want to run in certain circumstances, like a CI environment, and you may not want to require them to be installed on a given system (eg: a developer machine). If you want to reference a reporter but still run tests if that reporter is not installed or not found, use `optional_reporters` in `magellan.json`:

```json
{
  "reporters": [
    "./path/to/my/reporter",
  ],
  "optional_reporters": [
    "my_optional_reporter_module"
  ]
}
```

Setup and Teardown
==================

If you need to run setup and teardown tasks before and after your test suite runs, respectively, it's recommended to write npm tasks for that purpose and simply sandwich your `magellan` call between them.

Sometimes, however, you need a setup and teardown process that constructs state **within Node** and then cleans up afterwards. For this use case, Magellan also supports a global setup and teardown hook that will run before and after your suite. To register a setup and teardown, add a path to your `magellan.json`:

```json
{
  "setup_teardown": "path/to/setup_teardown.js",
}
```

Magellan will `require()` these modules and run them as functions that should call a callback. Setup and teardown modules should look like this:

```javascript
var Q = require("q");

var SetupTeardown = function () {
};

SetupTeardown.prototype = {
  initialize: function () {
    var deferred = Q.defer();

    // do asynchronous setup stuff here. Resolve (or reject) promise when ready.
    doAsyncStuff(function (){
      deferred.resolve();
    });

    return deferred.promise;
  },

  flush: function () {
    var deferred = Q.defer();

    // do asynchronous teardown stuff here. Resolve (or reject) promise when ready.
    doAsyncStuff(function (){
      deferred.resolve();
    });

    return deferred.promise;

  }
};

module.exports = SetupTeardown;
```

Note: Magellan should ensure that `flush()` always runs even if your test suite fails.

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
```

A Sauce Connect tunnel prefix must be set for tunnel management to work when using `--create_tunnels` (see more on this below).

```
# Tunnel id prefix, Example: "my_tunnel", "qa_tunnel", etc
export SAUCE_TUNNEL_ID="xxxxxxxxx"
```

Listing and Using SauceLabs Browsers
====================================

Magellan can query the SauceLabs API for a list of available browsers (for web testing) and devices (for native app testing in iOS and Android), and present them as a list of friendly browser ids:

```console
$ magellan --list_browsers
```

To use a given SauceLabs browser, specify it when using the `--sauce` option:

```console
$ magellan --sauce --browser=chrome_42_Windows_2012_R2_Desktop
```

To use multiple SauceLabs browsers and environments at the same time, simply list multiple ids:
```
$ magellan --sauce --browsers=chrome_42_Windows_2012_R2_Desktop,safari_7_OS_X_10_9_Desktop
```

Note: If you are building reporting or CI tools and want to use the same SauceLabs API and browser naming support toolset, check out [guacamole](https://github.com/TestArmada/guacamole).

SauceLabs Tunnelling Support (Sauce Connect)
============================================

**NOTE**: By default, Magellan assumes that tests run on an open network visible to SauceLabs.

If your tests are running in a closed CI environment not visible to the Internet, a tunnel is required from SauceLabs to your test machine (when using `--sauce` mode). To activate tunnel creation, use `--create_tunnels`. Magellan will create a tunnel for the test run. If you want to distribute your work load across more than one tunnel, specify the `--max_tunnels=N` option, like so:

```console
$ magellan --sauce --browser=chrome_42_Windows_2012_R2_Desktop --create_tunnels --max_tunnels=4 --max_workers=16
```

In the above example, 4 tunnels will be distributed amongst 16 workers.

SauceLabs VM Traffic Control (`locks`)
======================================

To specify a `locks` server, set the environment variable `LOCKS_SERVER`:

```
export LOCKS_SERVER=http://locks.server.example:4765/
```

or use the `--locks_server` option:
```
$ magellan --locks_server=http://locks.server.example:4765 --sauce --browser=chrome_42_Windows_2012_R2_Desktop --create_tunnels --max_tunnels=4 --max_workers=16
```

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

Hosted Browser Profiles
=======================

If you're using profiles to reflect browser tiers in a large organization, you may wish to centralize your profiles on a web server somewhere and have `magellan` load them remotely. To do this, specify a profile URL to source profiles from, and the profile you want to use after a `#` (hash):

```console
$ magellan --profile=http://example.com/testing/browser_profiles.json#tier2
```

Multiple profiles can be specified the same way, comma delimited:

```console
$ magellan --profile=http://example.com/testing/browser_profiles.json#tier1,tier2
```


Where `browser_profiles.json` should have a structure similar to placing `profiles{}` in `magellan.json`:

```json
{
  "profiles": {
    "tier_2": [
      { "browser": "safari_7_OS_X_10_9_Desktop" },
      { "browser": "IE_8_Windows_2008_Desktop" },
      { "browser": "IE_9_Windows_2008_Desktop" },
      { "browser": "IE_10_Windows_2008_Desktop" }
    ]
  }
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

Using Magellan's Port Acquisition and Scanning Facilities
=========================================================

If you need to be able to consume ports during a magellan run and want to be absolutely certain they won't conflict with those that magellan gives to its worker pool, you can use the `portUtils` submodule like this in your setup and teardown tasks:

```javascript

var magellan = require("testarmada-magellan");

// calls callback with arguments [null, 12000] if successful
magellan.portUtil.acquirePort(function(err, port) {
  if (err) {
    console.log("error!", err);
  } else {
    console.log("Got port " + port + " for safe usage.");
  }
});

```

## Licenses

All code not otherwise specified is Copyright Wal-Mart Stores, Inc.
Released under the [MIT](./LICENSE) License.
