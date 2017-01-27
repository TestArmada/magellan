"use strict";

module.exports = {
  name: "testarmada-magellan",
  shortName: "magellan",

  help: {
    "serial": {
      "category": "Parallelism, Workflow and Filtering",
      "description": "Run tests one at a time with detailed output."
    },
    "max_workers": {
      "category": "Parallelism, Workflow and Filtering",
      "example": "N",
      "description": "Set maximum number of parallel works to (see defaults below)."
    },
    "max_test_attempts": {
      "category": "Parallelism, Workflow and Filtering",
      "example": "N",
      "description": "Retry tests N times (default: 3)."
    },
    "bail_early": {
      "category": "Parallelism, Workflow and Filtering",
      "description": "Kill builds that have failed at least 10% of tests, after 10 or more test runs."
    },
    "bail_fast": {
      "category": "Parallelism, Workflow and Filtering",
      "description": "Kill builds that fail any test."
    },
    "bail_time": {
      "category": "Parallelism, Workflow and Filtering",
      "description": "Set test kill time in milliseconds. *CAN* be used without bail_early/bail_fast."
    },
    "early_bail_threshold": {
      "category": "Parallelism, Workflow and Filtering",
      "description": "A decimal ratio (eg 0.25 for 25%) how many tests to fail before bail_early"
    },
    "early_bail_min_attempts": {
      "category": "Parallelism, Workflow and Filtering",
      "description": "How many test runs to run before applying bail_early rule."
    },
    "debug": {
      "category": "Parallelism, Workflow and Filtering",
      "description": "Enable debugging magellan messages (dev mode)."
    },
    "config": {
      "category": "Configuration",
      "example": "config-path",
      "description": "Specify Magellan configuration location."
    },
    "temp_dir": {
      "category": "Configuration",
      "example": "path",
      "description": "Specify temporary file directory for Magellan (default: temp/)."
    },
    "aggregate_screenshots": {
      "category": "Reporting and CI Integration",
      "description": "Activate harvesting of screenshots for uploading to a screenshot service."
    },
    "screenshot_aggregator_url": {
      "category": "Reporting and CI Integration",
      "example": "http://some.image.url",
      "description": "Specify the URL to the screenshot service endpoint."
    },
    "external_build_id": {
      "category": "Reporting and CI Integration",
      "example": "magellanBuildId312123",
      "description": "Use an external build id, i.e. from CI. Must be filename and URL-safe."
    },
    "profile": {
      "category": "environment support",
      "example": "p1,p2,..",
      "description": "Specify lists of browsers to use defined in profiles in magellan.json config."
    },
    "profile": {
      "category": "environment support",
      "example": "http://abc/p#p1,p2 ",
      "description": "Use profiles p1 and p2 hosted at JSON file http://abc/p (see README for details)."
    }
  }
};