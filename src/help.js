"use strict";

/*eslint-disable max-len*/
/*eslint-disable no-dupe-keys*/
module.exports = {
  name: "testarmada-magellan",
  shortName: "magellan",

  help: {
    "help": {
      "category": "Usability",
      "visible": false,
      "description": "List options of magellan and all configured frameworks, executors and plugins in magellan.json."
    },
    "serial": {
      "category": "Parallelism, Workflow and Filtering",
      "visible": true,
      "description": "Run tests one at a time with detailed output."
    },
    "max_workers": {
      "category": "Parallelism, Workflow and Filtering",
      "example": "N",
      "visible": true,
      "description": "Set maximum number of parallel works to (see defaults below)."
    },
    "max_test_attempts": {
      "category": "Parallelism, Workflow and Filtering",
      "example": "N",
      "visible": true,
      "description": "Retry tests N times (default: 3)."
    },
    "test_timeout": {
      "category": "Parallelism, Workflow and Filtering",
      "example": "80000",
      "visible": true,
      "description": "Set test kill time in milliseconds (default: 480000ms)."
    },
    "strategy_bail": {
      "category": "Strategy",
      "example": "./strategy/fast_bail",
      "visible": true,
      "description": "The strategy magellan uses to decide when to terminate current test suite if failure happens."
    },
    "bail_early": {
      "category": "Bail Strategy [Will be deprecated soon, please migrate to --strategy_bail]",
      "visible": true,
      "description": "Kill builds that have failed at least 10% of tests, after 10 or more test runs."
    },
    "bail_fast": {
      "category": "Bail Strategy [Will be deprecated soon, please migrate to --strategy_bail]",
      "visible": true,
      "description": "Kill builds that fail any test."
    },
    "bail_time": {
      "category": "Bail Strategy [Will be deprecated soon, please migrate to --strategy_bail]",
      "visible": true,
      "description": "Set test kill time in milliseconds. *CAN* be used without bail_early/bail_fast."
    },
    "early_bail_threshold": {
      "category": "Bail Strategy [Will be deprecated soon, please migrate to --strategy_bail]",
      "visible": true,
      "description": "A decimal ratio (eg 0.25 for 25%) how many tests to fail before bail_early"
    },
    "early_bail_min_attempts": {
      "category": "Bail Strategy [Will be deprecated soon, please migrate to --strategy_bail]",
      "visible": true,
      "description": "How many test runs to run before applying bail_early rule."
    },
    "debug": {
      "category": "Parallelism, Workflow and Filtering",
      "visible": true,
      "description": "Enable debugging magellan messages (dev mode)."
    },
    "config": {
      "category": "Configuration",
      "visible": true,
      "example": "config-path",
      "description": "Specify Magellan configuration location."
    },
    "temp_dir": {
      "category": "Configuration",
      "visible": true,
      "example": "path",
      "description": "Specify temporary file directory for Magellan (default: temp/)."
    },
    "aggregate_screenshots": {
      "category": "Reporting and CI Integration",
      "visible": true,
      "description": "Activate harvesting of screenshots for uploading to a screenshot service."
    },
    "screenshot_aggregator_url": {
      "category": "Reporting and CI Integration",
      "visible": true,
      "example": "http://some.image.url",
      "description": "Specify the URL to the screenshot service endpoint."
    },
    "external_build_id": {
      "category": "Reporting and CI Integration",
      "visible": true,
      "example": "magellanBuildId312123",
      "description": "Use an external build id, i.e. from CI. Must be filename and URL-safe."
    },
    "profile": {
      "category": "Environment support",
      "visible": true,
      "example": "p1,p2,..",
      "description": "Specify lists of browsers to use defined in profiles in magellan.json config."
    },
    "profile": {
      "category": "Environment support",
      "visible": true,
      "example": "http://abc/p#p1,p2 ",
      "description": "Use profiles p1 and p2 hosted at JSON file http://abc/p (see README for details)."
    },
    "profiles": {
      "category": "Environment support",
      "visible": false,
      "description": "A JSON object contains desiredCapabilities"
    },
    "framework": {
      "category": "Framework",
      "visible": false,
      "example": "nightwatch",
      "description": "Framework which magellan will drive tests with."
    },
    "executors": {
      "category": "Executors",
      "visible": false,
      "example": "local",
      "description": "Executors which magellan will use to execute test"
    }
  }
};
