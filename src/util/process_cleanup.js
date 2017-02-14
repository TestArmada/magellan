"use strict";

const treeUtil = require("testarmada-tree-kill");
const _ = require("lodash");

const pid = process.pid;
const settings = require("../settings");
const logger = require("../logger");

// Max time before we forcefully kill child processes left over after a suite run
const ZOMBIE_POLLING_MAX_TIME = 15000;

module.exports = (callback, opts) => {
  const runOpts = _.assign({
    settings,
    treeUtil
  }, opts);

  if (runOpts.settings.debug) {
    logger.log("Checking for zombie processes...");
  }

  runOpts.treeUtil.getZombieChildren(pid, ZOMBIE_POLLING_MAX_TIME, (zombieChildren) => {
    if (zombieChildren.length > 0) {
      logger.log("Giving up waiting for zombie child processes to die. Cleaning up..");

      const killNextZombie = () => {
        if (zombieChildren.length > 0) {
          const nextZombieTreePid = zombieChildren.shift();
          logger.log("Killing pid and its child pids: " + nextZombieTreePid);
          runOpts.treeUtil.kill(nextZombieTreePid, "SIGKILL", killNextZombie);
        } else {
          logger.log("Done killing zombies.");
          return callback();
        }
      };

      return killNextZombie();
    } else {
      logger.debug("No zombies found.");
      return callback();
    }
  });
};
