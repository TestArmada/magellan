"use strict";

const _ = require("lodash");

const project = require("../package.json");
const settings = require("./settings");

/*eslint max-len: 0*/
/*eslint max-statements: 0*/
module.exports = {
  help: (opts) => {
    const runOpts = _.assign({
      console,
      settings
    }, opts);

    runOpts.console.log("Usage: magellan [options]");
    runOpts.console.log("");
    runOpts.console.log("By default, magellan will run all available tests in parallel with phantomjs.");
    runOpts.console.log("");
    runOpts.console.log(" Parallelism, Workflow and Filtering:");
    runOpts.console.log("  --serial                       Run tests one at a time with detailed output.");
    runOpts.console.log("  --max_workers=N                Set maximum number of parallel works to (see defaults below).");
    runOpts.console.log("  --max_test_attempts=N          Retry tests N times (default: 3).");
    runOpts.console.log("  --bail_early                   Kill builds that have failed at least 10% of tests, after 10 or more test runs.");
    runOpts.console.log("  --bail_fast                    Kill builds that fail any test.");
    runOpts.console.log("  --bail_time                    Set test kill time in milliseconds. *CAN* be used without bail_early/bail_fast.");
    runOpts.console.log("  --early_bail_threshold         A decimal ratio (eg 0.25 for 25%) how many tests to fail before bail_early");
    runOpts.console.log("  --early_bail_min_attempts      How many test runs to run before applying bail_early rule.");
    runOpts.console.log("  --debug                        Enable debugging magellan messages (dev mode).");
    runOpts.console.log("");
    runOpts.console.log(" Configuration:");
    runOpts.console.log("  --config=config-path           Specify Magellan configuration location.");
    runOpts.console.log("  --temp_dir=path                Specify temporary file directory for Magellan (default: temp/).");
    runOpts.console.log("");
    runOpts.console.log(" Reporting and CI Integration:");
    runOpts.console.log("  --aggregate_screenshots        Activate harvesting of screenshots for uploading to a screenshot service.");
    runOpts.console.log("  --screenshot_aggregator_url    Specify the URL to the screenshot service endpoint.");
    runOpts.console.log("  --external_build_id            Use an external build id, i.e. from CI. Must be filename and URL-safe.");
    runOpts.console.log("");
    runOpts.console.log(" Browser and SauceLabs Support:");
    // runOpts.console.log("  --sauce                        Run tests on SauceLabs cloud.");
    // runOpts.console.log("  --list_browsers                List the available browsers configured.");
    // runOpts.console.log("  --browser=browsername          Run tests in chrome, firefox, etc (default: phantomjs).");
    // runOpts.console.log("  --browsers=b1,b2,..            Run multiple browsers in parallel.");
    // runOpts.console.log("  --browsers=all                 Run all available browsers (sauce only).");
    // runOpts.console.log("  --create_tunnels               Create secure tunnels in sauce mode (for use with --sauce only)");
    // runOpts.console.log("  --sauce_tunnel_id              Use an existing secure tunnel (for use with --sauce only, exclusive with --create_tunnels)");
    // runOpts.console.log("  --shared_sauce_parent_account  Specify parent account name if existing shared secure tunnel is in use (for use with --sauce only, exclusive with --create_tunnels)");
    runOpts.console.log("  --profile=p1,p2,..             Specify lists of browsers to use defined in profiles in magellan.json config.");
    runOpts.console.log("  --profile=http://abc/p#p1,p2   Use profiles p1 and p2 hosted at JSON file http://abc/p (see README for details).");
    runOpts.console.log("");

    let help = {};

    if (runOpts.settings.testFramework && runOpts.settings.testFramework.help) {
      help[" Framework-specific (" + runOpts.settings.framework + ")"] = runOpts.settings.testFramework.help;
    }

    if (runOpts.settings.testExecutors) {
      _.forEach(runOpts.settings.testExecutors, (v, k) => {
        if (v.help) {
          help[" Executor-specific (" + v.name + ")"] = v.help;
        }
      });
    }

    if (help) {
      const maxWidth = 40;

      _.forEach(help, (helpValue, helpKey) => {
        runOpts.console.log(helpKey);

        _.forEach(helpValue, (itemValue, itemKey) => {
          let str = "  --" + itemKey;
          if (itemValue.example) {
            str += "=" + itemValue.example;
          }

          while (str.length < maxWidth) {
            str += " ";
          }

          // truncate just in case the example was too long to begin with
          str = str.substr(0, maxWidth);
          str += itemValue.description;
          runOpts.console.log(str);
        });
        runOpts.console.log("");
      });
    }

    runOpts.console.log("");
    runOpts.console.log("  +------------------------------------------+-----------+-------------------+");
    runOpts.console.log("  | Workflow / Output Examples               | # workers | output style      |");
    runOpts.console.log("  +------------------------------------------+-----------+-------------------+");
    runOpts.console.log("  |--browser=phantomjs                       | 8         | summary, failures |");
    runOpts.console.log("  |--browser=<not phantom> --sauce           | 3         | summary, failures |");
    runOpts.console.log("  |--browser=<not phantom>                   | 3         | summary, failures |");
    runOpts.console.log("  |--sauce --browser=<xxxx> --serial         | 1         | detail, all tests |");
    runOpts.console.log("  |--sauce --browser=<not phantom> --serial  | 1         | detail, all tests |");
    runOpts.console.log("  |--browser=<any> --serial                  | 1         | detail, all tests |");
    runOpts.console.log("  +------------------------------------------+-----------+-------------------+");

    runOpts.console.log("");
    runOpts.console.log("magellan v" + project.version);
  }
};
