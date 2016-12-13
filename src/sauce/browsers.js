"use strict";

var Q = require("q");
var _ = require("lodash");
var SauceBrowsers = require("guacamole");
var listSauceCliBrowsers = require("guacamole/src/cli_list");

module.exports = {

  //
  // TODO: the actual listing of browsers should be provided by guacamole
  //
  listBrowsers: function (opts) {
    var _c = console;
    /* istanbul ignore next */
    if (opts && opts.console) {
      _c = opts.console;
    }
    var _listSauceCliBrowsers = listSauceCliBrowsers;
    /* istanbul ignore next */
    if (opts && opts.listSauceCliBrowsers) {
      _listSauceCliBrowsers = opts.listSauceCliBrowsers;
    }

    _listSauceCliBrowsers(function (browserTable) {
      // convert table heading
      browserTable.options.head[1] = "Copy-Paste Command-Line Option";
      _c.log(browserTable.toString());
      _c.log("");
      _c.log("Non-Sauce Browser List:");
      _c.log("  --browser=chrome\t\tLocal Chrome browser");
      _c.log("  --browser=firefox\t\tLocal Firefox browser");
      _c.log("  --browser=safari\t\tLocal Safari browser");
      _c.log("  --browser=phantomjs\t\tLocal Phantomjs browser [default in non-sauce mode]");
    });
  },

  // Return a browser by id if it exists in our browser list. Optionally return that browser
  // only if a resolution is supported by that browser environment
  browser: function (id, resolution, orientation) {
    var results = SauceBrowsers.get({
      id: id,
      screenResolution: resolution,
      deviceOrientation: orientation
    }, true);

    var result;
    if (results.length > 0) {
      var browser = results[0];
      result = _.extend({
        id: id,
        resolutions: browser.resolutions
      }, browser.desiredCapabilities);
    }

    return result;
  },

  addDevicesFromFile: function (filePath) {
    SauceBrowsers.addNormalizedBrowsersFromFile(filePath);
  },

  initialize: function (fetchSauceBrowsers) {
    if (fetchSauceBrowsers) {
      return SauceBrowsers.initialize();
    } else {
      var d = Q.defer();
      d.resolve();
      return d.promise;
    }
  }
};
