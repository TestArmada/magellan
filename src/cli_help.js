"use strict";

const _ = require("lodash");

const project = require("../package.json");
const settings = require("./settings");
const magellanHelp = require("./help").help;

const MAX_HELP_KEY_WIDTH = 40;

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

    let help = {};

    // load magellan help by default
    _.forEach(magellanHelp, (v, k) => {
      if (v.visible === undefined || v.visible) {
        if (!help[v.category]) {
          help[v.category] = {};
        }
        help[v.category][k] = v;
      }
    });

    // load desire framework help
    if (runOpts.settings.testFramework && runOpts.settings.testFramework.help) {
      help[" Framework-specific (" + runOpts.settings.framework + ")"] = {};

      _.forEach(runOpts.settings.testFramework.help, (v, k) => {
        if (v.visible === undefined || v.visible) {
          help[" Framework-specific (" + runOpts.settings.framework + ")"][k] = v;
        }
      });
    }

    // load desire executor(s) help
    if (runOpts.settings.testExecutors) {
      _.forEach(runOpts.settings.testExecutors, (v, k) => {
        if (v.help) {
          help[" Executor-specific (" + v.name + ")"] = {};

          _.forEach(v.help, (itemValue, itemKey) => {
            console.log(itemValue)
            if (itemValue.visible === undefined || itemValue.visible) {
              help[" Executor-specific (" + v.name + ")"][itemKey] = itemValue;
            }
          });
        }
      });
    }

    if (help) {
      _.forEach(help, (helpValue, helpKey) => {
        runOpts.console.log(helpKey);

        _.forEach(helpValue, (itemValue, itemKey) => {
          let str = "  --" + itemKey;
          if (itemValue.example) {
            str += "=" + itemValue.example;
          }

          while (str.length < MAX_HELP_KEY_WIDTH) {
            str += " ";
          }

          // truncate just in case the example was too long to begin with
          str = str.substr(0, MAX_HELP_KEY_WIDTH);
          str += itemValue.description;
          runOpts.console.log(str);
        });
        runOpts.console.log("");
      });
    }

    runOpts.console.log("");
    runOpts.console.log("magellan v" + project.version);
  }
};
