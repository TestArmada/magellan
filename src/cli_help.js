"use strict";

var project = require("../package.json");
var settings = require("./settings");

/*eslint max-len: 0*/
/*eslint max-statements: 0*/
module.exports = {
  help: function (opt) {
    var _console = console;
    /* istanbul ignore next */
    if (opt && opt.console) {
      _console = opt.console;
    }
    var _settings = settings;
    /* istanbul ignore next */
    if (opt && opt.settings) {
      _settings = opt.settings;
    }

    _console.log("Usage: magellan [options]");
    _console.log("");
    _console.log("By default, magellan will run all available tests in parallel with phantomjs.");
    _console.log("");
    _console.log(" Parallelism, Workflow and Filtering:");
    _console.log("  --serial                       Run tests one at a time with detailed output.");
    _console.log("  --max_workers=N                Set maximum number of parallel works to (see defaults below).");
    _console.log("  --max_test_attempts=N          Retry tests N times (default: 3).");
    _console.log("  --bail_early                   Kill builds that have failed at least 10% of tests, after 10 or more test runs.");
    _console.log("  --bail_fast                    Kill builds that fail any test.");
    _console.log("  --bail_time                    Set test kill time in milliseconds. *CAN* be used without bail_early/bail_fast.");
    _console.log("  --early_bail_threshold         A decimal ratio (eg 0.25 for 25%) how many tests to fail before bail_early");
    _console.log("  --early_bail_min_attempts      How many test runs to run before applying bail_early rule.");
    _console.log("  --debug                        Enable debugging magellan messages (dev mode).");
    _console.log("");
    _console.log(" Configuration:");
    _console.log("  --config=config-path           Specify Magellan configuration location.");
    _console.log("  --temp_dir=path                Specify temporary file directory for Magellan (default: temp/).");
    _console.log("");
    _console.log(" Reporting and CI Integration:");
    _console.log("  --aggregate_screenshots        Activate harvesting of screenshots for uploading to a screenshot service.");
    _console.log("  --screenshot_aggregator_url    Specify the URL to the screenshot service endpoint.");
    _console.log("  --external_build_id            Use an external build id, i.e. from CI. Must be filename and URL-safe.");
    _console.log("");
    _console.log(" Browser and SauceLabs Support:");
    _console.log("  --sauce                        Run tests on SauceLabs cloud.");
    _console.log("  --list_browsers                List the available browsers configured.");
    _console.log("  --browser=browsername          Run tests in chrome, firefox, etc (default: phantomjs).");
    _console.log("  --browsers=b1,b2,..            Run multiple browsers in parallel.");
    _console.log("  --browsers=all                 Run all available browsers (sauce only).");
    _console.log("  --create_tunnels               Create secure tunnels in sauce mode (for use with --sauce only)");
    _console.log("  --sauce_tunnel_id              Use an existing secure tunnel (for use with --sauce only, exclusive with --create_tunnels)");
    _console.log("  --shared_sauce_parent_account  Specify parent account name if existing shared secure tunnel is in use (for use with --sauce only, exclusive with --create_tunnels)");
    _console.log("  --profile=p1,p2,..             Specify lists of browsers to use defined in profiles in magellan.json config.");
    _console.log("  --profile=http://abc/p#p1,p2   Use profiles p1 and p2 hosted at JSON file http://abc/p (see README for details).");

    var help;

    if (_settings.testFramework && _settings.testFramework.help) {
      help = _settings.testFramework.help;
    }

    if (help) {
      _console.log("");
      _console.log(" Framework-specific (" + _settings.framework + "):");
      var maxWidth = 31;

      Object.keys(help).forEach(function (key) {
        var str = "  --" + key;
        if (help[key].example) {
          str += "=" + help[key].example;
        }
        // pad
        while (str.length < maxWidth) {
          str += " ";
        }
        // truncate just in case the example was too long to begin with
        str = str.substr(0, maxWidth);
        str += help[key].description;
        _console.log(str);
      });
    }

    _console.log("");
    _console.log("  +------------------------------------------+-----------+-------------------+");
    _console.log("  | Workflow / Output Examples               | # workers | output style      |");
    _console.log("  +------------------------------------------+-----------+-------------------+");
    _console.log("  |--browser=phantomjs                       | 8         | summary, failures |");
    _console.log("  |--browser=<not phantom> --sauce           | 3         | summary, failures |");
    _console.log("  |--browser=<not phantom>                   | 3         | summary, failures |");
    _console.log("  |--sauce --browser=<xxxx> --serial         | 1         | detail, all tests |");
    _console.log("  |--sauce --browser=<not phantom> --serial  | 1         | detail, all tests |");
    _console.log("  |--browser=<any> --serial                  | 1         | detail, all tests |");
    _console.log("  +------------------------------------------+-----------+-------------------+");

    _console.log("");
    _console.log("magellan v" + project.version);
  }
};
