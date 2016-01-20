Test Framework Plugins
======================

Note: This document is a work in progress. If anything seems to be out of date or incomplete,
the best place for an authoritative answer is the source code of our currently-supported plugins.

Plugin Module Structure
=======================

A magellan test framework plugin is just a node module that exports the following signature:

```javascript
{
  initialize: function (argv) {
    // argv: command line arguments and stored configuration loaded by magellan
    // This provides your plugin with the opportunity to look at command line arguments
    // and retrieve magellan configuration.
  },

  iterator: //<< returns list of tests (see "Generating Lists of Tests" below) >>

  TestRun: //<< constructor for TestRun class (see below) >>

  filters: //<< test filter definitions, >>
}
```

#### Generating Lists of Tests

```javascript
  function getTests () {
    return tests;
  }
```

The `iterator` property of the plugin is a function that returns an array of test objects.

Each object should represent exactly one test.

Magellan doesn't care how the object is structured, except that the object should implement a
`toString()` method so that Magellan can display a human-readable name for the test on the screen.

If your test framework makes human-readable test names available and you are able to parse or query
these with your plugin, it's recommended that your `toString()` implementation returns a name as
opposed to a filename. For example:

```javascript
> var t = new Locator("/path/to/test.js", "Should add integers and return an integer");
> t.toString()
"Should add integers and return an integer"
```

#### TestRun Class

```javascript
var _ = require("lodash");

var MyFrameworkTestRun = function (options) {
  _.extend(this, options);
};

// Return command path of binary
MyFrameworkTestRun.prototype.getCommand = function () {
  return "./node_modules/.bin/myframework";
};

// Return environment variables
// Either pass-through, suppress entirely, or amend existing env supplied from magellan process
MyFrameworkTestRun.prototype.getEnvironment = function (env) {
  return _.extend(env, {
    MY_EXTRA_ENVIRONMENT_VARIABLE: 123
  });
};

// Return command line arguments for test framework binary
// In this example, we just return our locator. See mocha plugin source for a more advanced example
MyFrameworkTestRun.prototype.getArguments = function () {
  return [ this.locator.filename ];
};

module.exports = MyFrameworkTestRun;
```

##### TestRun `options` supplied by `magellan`

When magellan instantiates `TestRun` objects, it supplies information related to the test and
environment specifically for that individual test run. The following snippet describes the supplied
properties:

```javascript
{
  // The id of this build, used by some reporters to identify the overall suite run. This
  // can also be used by test run implementations to identify an individual suite run as
  // part of some larger suite run.
  // NOTE: This must appear as an externally accessible property on the TestRun instance
  buildId: "...",

  // Temporary asset path that Magellan guarantees exists and only belongs to this
  // individual test run. Temporary files, logs, screenshots, etc can be put here.
  tempAssetPath: "...",

  // Magellan environment id (i.e. id of browser, id of device, version, etc.),
  // typically reflects one of the items from --browsers=item1,item2,item3 options
  environmentId: "...",

  // Test locator object originally created by plugin's iterator
  locator: {},

  // Ports that have been found safe to use for selenium and mocking (if needed)
  // and are unique from any other currently-executing parallel test
  seleniumPort: number,
  mockingPort: number,

  // Secure tunnel id (if using sauce)
  tunnelId: "...",

  // Saucelabs configuration
  sauceSettings: {},

  // Saucelabs desired capabilities object
  sauceBrowserSettings: {}
}
```
