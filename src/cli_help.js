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
      if (!help[v.category]) {
        help[v.category] = {};
      }

      help[v.category][k] = v;
    });

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
