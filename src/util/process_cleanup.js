"use strict";

var treeUtil = require("testarmada-tree-kill");
var pid = process.pid;

// Max time before we forcefully kill child processes left over after a suite run
var CHILD_POLLING_MAX_TIME = 15000;
var TREE_CHECK_INTERVAL = 1000;

module.exports = function (callback) {
  var pollingStartTime = Date.now();

  var checkTree = function () {

    // Fetch magellan's child process list
    treeUtil.getTree(pid, function (tree) {
      var children = tree[pid.toString()];

      // If we have child processes, either kill them or wait a bit longer.
      if (children && children.length) {

        // leftover child processes
        if (Date.now() - pollingStartTime > CHILD_POLLING_MAX_TIME) {
          console.log("Giving up waiting for child processes to shut down. Killing forefully.");
          treeUtil.killChildProcesses(pid, callback);
        } else {
          console.log("Found " + children.length + " child processes. "
            + "Waiting for graceful close...");
          console.log("tree: ", tree);
          setTimeout(checkTree, TREE_CHECK_INTERVAL);
        }

      } else {

        // no leftover child processes
        return callback();
      }
    });
  };

  checkTree();
};
