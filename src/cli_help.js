'use strict';

const _ = require('lodash');
const clc = require('cli-color');

const project = require('../package.json');
const settings = require('./settings');
const magellanHelp = require('./help').help;
const logger = require('./logger');

const MAX_HELP_KEY_WIDTH = 60;

/*eslint max-len: 0*/
/*eslint max-statements: 0*/
module.exports = {
  help: (opts) => {

    logger.loghelp('');
    logger.loghelp('Usage: magellan [options]');
    logger.loghelp('');
    logger.loghelp('Available options:');
    logger.loghelp('');

    const help = {};

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
    if (settings.testFramework && settings.testFramework.help) {
      help[` Framework-specific (${clc.greenBright(settings.framework)})`] = {};

      _.forEach(settings.testFramework.help, (v, k) => {
        if (v.visible === undefined || v.visible) {
          help[` Framework-specific (${clc.greenBright(settings.framework)})`][k] = v;
        }
      });
    }

    // load desire executor(s) help
    if (settings.testExecutors) {
      _.forEach(settings.testExecutors, (v) => {
        if (v.help) {
          help[` Executor-specific (${clc.greenBright(v.name)})`] = {};

          _.forEach(v.help, (itemValue, itemKey) => {
            if (itemValue.visible === undefined || itemValue.visible) {
              help[` Executor-specific (${clc.greenBright(v.name)})`][itemKey] = itemValue;
            }
          });
        }
      });
    }

    // load desire strategy help
    if (settings.strategies) {
      _.forEach(settings.strategies, (v) => {
        if (v.help) {
          help[` Strategy-specific (${clc.greenBright(v.name)})`] = {};

          _.forEach(v.help, (itemValue, itemKey) => {
            if (itemValue.visible === undefined || itemValue.visible) {
              help[` Strategy-specific (${clc.greenBright(v.name)})`][itemKey] = itemValue;
            }
          });
        }
      });
    }


    if (help) {
      _.forEach(help, (helpValue, helpKey) => {
        logger.loghelp(` ${clc.cyanBright(helpKey)}`);

        _.forEach(helpValue, (itemValue, itemKey) => {
          let str = '   --' + itemKey;
          if (itemValue.example) {
            str += '=' + itemValue.example;
          }

          while (str.length < MAX_HELP_KEY_WIDTH) {
            str += ' ';
          }

          // truncate just in case the example was too long to begin with
          str = str.substr(0, MAX_HELP_KEY_WIDTH);
          str += itemValue.description;
          logger.loghelp(str);
        });
        logger.loghelp('');
      });
    }

    logger.log(`Magellan@${project.version}`);
  }
};
