"use strict";

const treeUtil = require("testarmada-tree-kill");
const _ = require("lodash");

const pid = process.pid;
const settings = require("../settings");

// Max time before we forcefully kill child processes left over after a suite run
const ZOMBIE_POLLING_MAX_TIME = 15000;

module.exports = (callback, opts) => {
  const runOpts = _.assign({
    settings,
    console,
    treeUtil
  }, opts);

  if (runOpts.settings.debug) {
    runOpts.console.log("Checking for zombie processes...");
  }

  runOpts.treeUtil.getZombieChildren(pid, ZOMBIE_POLLING_MAX_TIME, (zombieChildren) => {
    if (zombieChildren.length > 0) {
      runOpts.console.log("Giving up waiting for zombie child processes to die. Cleaning up..");

      const killNextZombie = () => {
        if (zombieChildren.length > 0) {
          const nextZombieTreePid = zombieChildren.shift();
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
