var fs = require("fs");
var path = require("path");
var _ = require("lodash");
var settings = require("../../settings");

var lintConfig = function (conf) {
  // Ensure paths used by older versions of magellan are not in use, and issue helpful error messages
  // to users who have not transitioned their nightwatch configuration files yet.

  if ((_.isArray(conf.custom_assertions) && conf.custom_assertions_path.indexOf("./node_modules/magellan/lib/assertions") > -1)
      || conf.custom_assertions === "./node_modules/magellan/lib/assertions") {
    throw new Error("The path ./node_modules/magellan/lib/assertions has been deprecated and should be updated to the new magellan-nightwatch path in nightwatch configuration.");
  }

  if ((_.isArray(conf.custom_commands_path) && conf.custom_commands_path.indexOf("./node_modules/magellan/lib/commands") > -1)
      || conf.custom_commands_path === "./node_modules/magellan/lib/commands") {
    throw new Error("The paths ./node_modules/magellan/lib/commands has been deprecated and should be updated to the new magellan-nightwatch path in nightwatch configuration.");
  }

  if (conf.globals_path === "./node_modules/magellan/config/globals.js") {
    throw new Error("The path ./node_modules/magellan/config/globals.js should no longer be included in nightwatch configuration.");
  }

};

// throws file read/write exceptions, JSON parse exceptions
module.exports = function (sourceConfigPath, tempAssetPath, options) {
  var conf = require(path.resolve(sourceConfigPath));

  if (options.localSeleniumPort) {
    // Local-testing selenium port (non-sauce)
    // Tell nightwatch to both start and connect to a selenium server on port {seleniumPort}
    conf.selenium.port = options.localSeleniumPort;
    conf.test_settings.default.selenium_port = options.localSeleniumPort;
  }

  // Remote testing (sauce) selenium settings:
  /*
  "username": "",         
  "access_key": "",       
  "desiredCapabilities": {
    "browserName": "",    
    "platform": "",       
    "version": "",        
    "tunnel-identifier": "
  },
  */
  if (options.sauceSettings) {
    // Auth
    conf.test_settings.sauce.username = options.sauceSettings.username;
    conf.test_settings.sauce.access_key = options.sauceSettings.accessKey;

    if (!options.sauceBrowserSettings) {
      console.error("ERROR: Missing browser settings even though sauce cloud settings are active");
      throw new Error("invalid configuration");
    }

    conf.test_settings.sauce.desiredCapabilities = options.sauceBrowserSettings;
    if (settings.debug) {
      console.log("SauceLabs desiredCapabilities: ", options.sauceBrowserSettings);
    }

    if (options.sauceSettings.tunnelId) {
      conf.test_settings.sauce.desiredCapabilities["tunnel-identifier"] = options.sauceSettings.tunnelId;
    } else {
      // This property may exist, so blow it away
      delete conf.test_settings.sauce.desiredCapabilities["tunnel-identifier"];
    }
  }

  lintConfig(conf);

  // Write all the above details to a temporary config file, then return the temporary filename
  var tempConfigPath = path.resolve(tempAssetPath + "/nightwatch.json");

  fs.writeFileSync(tempConfigPath, JSON.stringify(conf), "utf8");

  return tempConfigPath;
};