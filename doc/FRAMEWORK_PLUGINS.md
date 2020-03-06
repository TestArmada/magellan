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

  TestRun: //<< constructor for TestRun class (see "TestRun Class" below) >>

  filters: //<< test filter definitions (see "Test Filters" below) >>
  
  help: //<< command line help definitions (see "Command Line Help" below) >>
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

Magellan doesn't care how the object is structured, except that the object should expose a `filename` 
property with the path to the test and should implement a `toString()` method so that Magellan can 
display a human-readable name for the test on the screen.

If your test framework makes human-readable test names available and you are able to parse or query
these with your plugin, it's recommended that your `toString()` implementation returns a name as
opposed to a filename. For example:

```javascript
> var t = new Locator("/path/to/test.js", "Should add integers and return an integer");
> t.toString()
"Should add integers and return an integer"
> t.filename
"/path/to/test.js"
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

Test Filters
============

The `filters` object allows for a test framework plugin to add command line switches related to filtering tests.
We recommend adding at least `--tags`, `--group`, and `--test` to preserve user's expectations of 

```javascript
filters: {

  // Adds --tags=xxxx command line switch
  tags: function (tags, testLocator) {
    /* return true if testLocator satisfies tags from --tags=t1,t2,.. */
  },

  // Adds --group=xxxx command line switch
  group: function (prefix, testLocator) {
    /* return true if testLocator satisfies prefix from --group=a/b/c*/
  },

  // Adds --test=xxxx command line switch
  test: function (testidentity, testLocator) {
    /* return true if testLocator is the same as --test=path-or-name */
  }
},
```

Command Line Help
=================

Your test framework plugin can expose a help object which will explain the usage of the command line options
added by your plugin. Here's an example, from the nightwatch plugin:

```javascript
{
  // document the --tags option
  tags: {
    // is rendered as --tags=tag1,tag2
    example: "tag1,tag2",
    description: "Run all tests that match a list of comma-delimited tags (eg: tag1,tag2)"
  },
  group: {
    // is rendered as --group=prefix/path
    example: "prefix/path",
    description: "Run all tests that match a path prefix like ./tests/smoke"
  },
  test: {
    // is rendered as --test=path/to/test.js
    example: "path/to/test.js",
    description: "Run one test with a path like ./tests/smoke/test2.js"
  },
  nightwatch_config: {
    example: "path",
    description: "Specify nightwatch.json location (magellan-nightwatch)"
  }
};
```

Note that your plugin has access to magellan's `argv` object via `initialize()` (see above). You can
document any switches your plugin supports in the above help object.
