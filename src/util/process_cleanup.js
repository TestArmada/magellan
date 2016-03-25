"use strict";

var treeUtil = require("testarmada-tree-kill");
var pid = process.pid;

// Max time before we forcefully kill child processes left over after a suite run
var ZOMBIE_POLLING_MAX_TIME = 15000;

module.exports = function (callback) {
  treeUtil.getZombieChildren(pid, ZOMBIE_POLLING_MAX_TIME, function (zombieChildren) {
    if (zombieChildren.length > 0) {
      console.log("Magellan giving up waiting for zombie child processes to die. Killing pids:");
      console.log(zombieChildren.join(", "));
      treeUtil.killPids(zombieChildren);
    }
    callback();
  });
};
