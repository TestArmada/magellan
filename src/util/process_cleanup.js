"use strict";

var treeUtil = require("testarmada-tree-kill");
var _ = require("lodash");

var pid = process.pid;
var settings = require("../settings");

// Max time before we forcefully kill child processes left over after a suite run
var ZOMBIE_POLLING_MAX_TIME = 15000;

module.exports = function (callback, opts) {
  var runOpts = _.assign({
    settings: settings,
    console: console,
    treeUtil: treeUtil
  }, opts);

  if (runOpts.settings.debug) {
    runOpts.console.log("Checking for zombie processes...");
  }

  runOpts.treeUtil.getZombieChildren(pid, ZOMBIE_POLLING_MAX_TIME, function (zombieChildren) {
    if (zombieChildren.length > 0) {
      runOpts.console.log("Giving up waiting for zombie child processes to die. Cleaning up..");

      var killNextZombie = function () {
        if (zombieChildren.length > 0) {
          var nextZombieTreePid = zombieChildren.shift();
          runOpts.console.log("Killing pid and its child pids: " + nextZombieTreePid);
          runOpts.treeUtil.kill(nextZombieTreePid, "SIGKILL", killNextZombie);
        } else {
          runOpts.console.log("Done killing zombies.");
          return callback();
        }
      };

      return killNextZombie();
    } else {
      if (runOpts.settings.debug) {
        runOpts.console.log("No zombies found.");
      }
      return callback();
    }
  });
};
