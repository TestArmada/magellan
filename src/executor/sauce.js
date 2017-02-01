"use strict";

const listSauceCliBrowsers = require("guacamole/src/cli_list");
const SauceBrowsers = require("guacamole");

module.exports = {
  name: "testarmada-magellan-sauce-executor",
  shortName: "sauce",

  getCapabilities: (profile) => {
    // profile key mapping
    // browser => id
    // resolution => screenResolution
    // orientation => deviceOrientation
    let p = {
      id: profile.browser
    };

    if(profile.resolution){
      p.screenResolution = profile.resolution;
    }

    if(profile.orientation){
      p.deviceOrientation = profile.orientation;
    }

    return SauceBrowsers
      .initialize()
      .then(() => {
        return new Promise((resolve, reject) => {
          try {
            let capabilities = SauceBrowsers.get(p)[0];
            // add executor info back to capabilities
            capabilities.executor = profile.executor;
            resolve(capabilities);
          } catch (e) {
            reject("Executor sauce cannot resolve profile "
              + profile);
          }
        });
      });

  },

  listBrowsers: (opts, callback) => {

    SauceBrowsers
      .initialize(true)
      .then(() => {
        return new Promise((resolve, reject) => {
          if (opts.margs.argv.device_additions) {
            SauceBrowsers.addDevicesFromFile(runOpts.margs.argv.device_additions);
          }
          resolve();
        });
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          listSauceCliBrowsers((browserTable) => {
            // convert table heading
            browserTable.options.head[1] = "Copy-Paste Command-Line Option";
            opts.console.log(browserTable.toString());
            opts.console.log("");
            resolve();
          });
        });
      })
      .then(() => {
        callback();
      })
      .catch((err) => {
        runOpts.console.log("Couldn't fetch sauce browsers. Error: ", err);
        runOpts.console.log(err.stack);
        callback();
      });
  },

  help: {
    "sauce_browser": {
      "visible": true,
      "type": "string",
      "example": "browsername",
      "description": "Run tests in chrome, firefox, etc (default: phantomjs)."
    },
    "sauce_browsers": {
      "visible": true,
      "type": "string",
      "example": "b1,b2,..",
      "description": "Run multiple browsers in parallel."
    },
    "sauce_list_browsers": {
      "visible": true,
      "type": "function",
      "description": "List the available browsers configured (Guacamole integrated)."
    },
    "sauce": {
      "visible": true,
      "type": "boolean",
      "description": "Run tests on SauceLabs cloud."
    },
    "sauce_create_tunnels": {
      "visible": true,
      "type": "boolean",
      "descriptions": "Create secure tunnels in sauce mode."
    },
    "sauce_tunnel_id": {
      "visible": true,
      "type": "string",
      "example": "testtunnel123123",
      "description": "Use an existing secure tunnel (exclusive with --sauce_create_tunnels)"
    },
    "shared_sauce_parent_account": {
      "visible": true,
      "type": "string",
      "example": "testsauceaccount",
      "description": "Specify parent account name if existing shared secure tunnel is in use (exclusive with --sauce_create_tunnels)"
    }
  }
};
