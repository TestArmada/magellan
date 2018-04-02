"use strict";

const treeUtil = require("testarmada-tree-kill");
const _ = require("lodash");

const pid = process.pid;
const settings = require("../settings");
const logger = require("../logger");

// Max time before we forcefully kill child processes left over after a suite run
const ZOMBIE_POLLING_MAX_TIME = 15000;

module.exports = (err) => {
  
  return new Promise((resolve, reject) => {
    if (settings.debug) {
      logger.log("Checking for zombie processes...");
    }

    treeUtil.getZombieChildren(pid, ZOMBIE_POLLING_MAX_TIME, (zombieChildren) => {
      if (zombieChildren.length > 0) {
        logger.log("Giving up waiting for zombie child processes to die. Cleaning up..");

        const killNextZombie = () => {
          if (zombieChildren.length > 0) {
            const nextZombieTreePid = zombieChildren.shift();
            logger.log("Killing pid and its child pids: " + nextZombieTreePid);
            treeUtil.kill(nextZombieTreePid, "SIGKILL", killNextZombie);
          } else {
            logger.log("Done killing zombies.");

            if (err) {
              // pass error down to next step
              return reject(err);
            } else {
              return resolve();
            }
          }
        };

        return killNextZombie();
      } else {
        logger.debug("No zombies found.");

        if (err) {
          // pass error down to next step
          return reject(err);
        } else {
          return resolve();
        }
      }
    });
  });
};
