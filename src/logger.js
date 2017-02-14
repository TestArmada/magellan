"use strict";

const argvs = require("yargs");
const util = require("util");
const clc = require("cli-color");

const debug = argvs.argv.debug;

const PREFIX = "Magellan";

module.exports = {
  output: console,

  debug(msg) {
    if (debug) {
      var deb = clc.blueBright("[DEBUG]");
      this.output.log(util.format("[%s] %s %s", PREFIX, deb, msg));
    }
  },
  log(msg) {
    var info = clc.greenBright("[INFO]");
    this.output.log(util.format("[%s] %s %s", PREFIX, info, msg));
  },
  warn(msg) {
    var warn = clc.yellowBright("[WARN]");
    this.output.warn(util.format("[%s] %s %s", PREFIX, warn, msg));
  },
  err(msg) {
    var err = clc.redBright("[ERROR]");
    this.output.error(util.format("[%s] %s %s", PREFIX, err, msg));
  },
  loghelp(msg) {
    this.output.log(msg);
  }
};