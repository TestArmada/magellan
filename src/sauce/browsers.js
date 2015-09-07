var Q = require("q");
var _ = require("lodash");
var Table = require("cli-table");
var clc = require("cli-color");
var settings = require("../settings");
var SauceBrowsers = require("guacamole");

module.exports = {

  listBrowsers: function () {
    var browsers = SauceBrowsers.get({}, true);
    var cliSuffix = "--browser=";

    var families = _.groupBy(browsers, function (browser) {
      return browser.family;
    });
    var maxFamWidth = _.max(Object.keys(families), function (f) { return f.length; }).length + 5;
    var maxCLIWidth = _.max(_.pluck(browsers, "id"), function (b) { return b.length; }).length + cliSuffix.length + 5;

    var maxBrowserWidth = _.max(browsers.map(function (b) { return b.desiredCapabilities.browserName || "Native app"; }), function (b) { return b.length; }).length + 5;
    var maxVersionWidth = _.max(browsers.map(function (b) { return b.desiredCapabilities.version || b.desiredCapabilities.platformVersion; }), function (b) { return b.toString().length; }).length + 5;
    var maxOSWidth = _.max(_.pluck(browsers, "desiredCapabilities.platform"), function (b) { return b.length; }).length + 5;
    var maxDeviceWidth = _.max(_.map(browsers, function (b) {
      return b.desiredCapabilities.deviceName || "Desktop";
    }), function (b) { return b.length; }).length + 5;

    var table = new Table({
      head: ["Family", "Copy-Paste Command-Line Option", "Browser/Env", "Version", "OS", "Device"],
      colWidths: [maxFamWidth, maxCLIWidth, maxBrowserWidth, maxVersionWidth, maxOSWidth, maxDeviceWidth]
    });

    var count = 1;

    Object.keys(families).sort().forEach(function (family) {
      table.push([clc.red(family)]);
      families[family].forEach(function (b) {
        table.push([
          clc.blackBright(count + "."),
          cliSuffix + b.id,
          b.desiredCapabilities.browserName || "Native app",
          b.desiredCapabilities.version || b.desiredCapabilities.platformVersion,
          b.desiredCapabilities.platform,
          (b.desiredCapabilities.deviceName ? clc.cyanBright(b.desiredCapabilities.deviceName) : "Desktop")
        ]);
        count++;
      });
    });

    console.log(table.toString());
    console.log("");
    console.log("Non-Sauce Browser List:");
    console.log("  --browser=chrome\t\tLocal Chrome browser");
    console.log("  --browser=firefox\t\tLocal Firefox browser");
    console.log("  --browser=safari\t\tLocal Safari browser");
    console.log("  --browser=phantomjs\t\tLocal Phantomjs browser [default in non-sauce mode]");
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
}