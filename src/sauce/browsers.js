"use strict";

const Q = require("q");
const _ = require("lodash");
const SauceBrowsers = require("guacamole");
const listSauceCliBrowsers = require("guacamole/src/cli_list");

module.exports = {

  //
  // TODO: the actual listing of browsers should be provided by guacamole
  //
  listBrowsers: (opts) => {
    const runOpts = _.assign({}, {
      console,
      listSauceCliBrowsers
    }, opts);

    runOpts.listSauceCliBrowsers((browserTable) => {
      // convert table heading
      browserTable.options.head[1] = "Copy-Paste Command-Line Option";
      runOpts.console.log(browserTable.toString());
      runOpts.console.log("");
      runOpts.console.log("Non-Sauce Browser List:");
      runOpts.console.log("  --browser=chrome\t\tLocal Chrome browser");
      runOpts.console.log("  --browser=firefox\t\tLocal Firefox browser");
      runOpts.console.log("  --browser=safari\t\tLocal Safari browser");
      runOpts.console.log(
        "  --browser=phantomjs\t\tLocal Phantomjs browser [default in non-sauce mode]");
    });
  },

  // Return a browser by id if it exists in our browser list. Optionally return that browser
  // only if a resolution is supported by that browser environment
  browser: (id, resolution, orientation) => {
    const results = SauceBrowsers.get({
      id,
      screenResolution: resolution,
      deviceOrientation: orientation
    }, true);

    let result;
    if (results.length > 0) {
      const browser = results[0];
      result = _.extend({
        id,
        resolutions: browser.resolutions
      }, browser.desiredCapabilities);
    }

    return result;
  },

  addDevicesFromFile: (filePath) => {
    SauceBrowsers.addNormalizedBrowsersFromFile(filePath);
  },

  initialize: (fetchSauceBrowsers) => {
    if (fetchSauceBrowsers) {
      return SauceBrowsers.initialize();
    } else {
      const d = Q.defer();
      d.resolve();
      return d.promise;
    }
  }
};
