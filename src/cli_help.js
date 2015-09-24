var project = require('../package.json');

module.exports = {
  help: function () {
    console.log("Usage: magellan [options]");
    console.log("");
    console.log("By default, magellan will run all available tests in parallel with phantomjs.");
    console.log("");
    console.log(" Parallelism, Workflow and Filtering:");
    console.log("  --serial                     Run tests one at a time with detailed output.");
    console.log("  --max_workers=N              Set maximum number of parallel works to (see defaults below).");
    console.log("  --max_test_attempts=N        Retry tests N times (default: 3).");
    console.log("  --tags=taglist               Run all tests that match a list of comma-delimited tags (eg: tag1,tag2)");
    console.log("  --group=prefix               Run all tests that match a path prefix like ./tests/smoke");
    console.log("  --test=path-to-test          Run one test with a path like ./tests/smoke/test2.js");
    console.log("  --bail_early                 Kill builds that have failed at least 10% of tests, after 10 or more test runs.");
    console.log("  --bail_fast                  Kill builds that fail any test.");
    console.log("  --bail_time                  Set test kill time in milliseconds. *CAN* be used without bail_early/bail_fast.")
    console.log("  --debug                      Enable debugging magellan messages (dev mode).");
    console.log("");
    console.log(" Configuration:");
    console.log("  --config=config-path         Specify Magellan configuration location.");
    console.log("  --nightwatch_config=path     Specify nightwatch.json location (magellan-nightwatch)");
    console.log("");
    console.log(" Reporting and CI Integration:");
    console.log("  --aggregate_screenshots      Activate harvesting of screenshots for uploading to a screenshot service.");
    console.log("  --screenshot_aggregator_url  Specify the URL to the screenshot service endpoint.");
    console.log("  --external_build_id          Use an external build id, i.e. from CI. Must be filename and URL-safe.");
    console.log("");
    console.log(" Browser and SauceLabs Support:");
    console.log("  --sauce                      Run tests on SauceLabs cloud.");
    console.log("  --list_browsers              List the available browsers configured.");
    console.log("  --browser=browsername        Run tests in chrome, firefox, etc (default: phantomjs).");
    console.log("  --browsers=b1,b2,..          Run multiple browsers in parallel.");
    console.log("  --browsers=all               Run all available browsers (sauce only).");
    console.log("  --create_tunnels             Create secure tunnels in sauce mode (for use with --sauce only)");
    console.log("  --profile=p1,p2,..           Specify lists of browsers to use defined in profiles in magellan.json config.")
    console.log("  --profile=http://abc/p#p1,p2 Use profiles p1 and p2 hosted at JSON file http://abc/p (see README for details).")
    console.log("");
    console.log("  +------------------------------------------+-----------+-------------------+");
    console.log("  | Workflow / Output Examples               | # workers | output style      |");
    console.log("  +------------------------------------------+-----------+-------------------+");
    console.log("  |--browser=phantomjs                       | 8         | summary, failures |");
    console.log("  |--browser=<not phantom> --sauce           | 3         | summary, failures |");
    console.log("  |--browser=<not phantom>                   | 3         | summary, failures |");
    console.log("  |--sauce --browser=<xxxx> --serial         | 1         | detail, all tests |");
    console.log("  |--sauce --browser=<not phantom> --serial  | 1         | detail, all tests |");
    console.log("  |--browser=<any> --serial                  | 1         | detail, all tests |");
    console.log("  +------------------------------------------+-----------+-------------------+");
    console.log("");
    console.log("magellan v" + project.version);
  }
};
