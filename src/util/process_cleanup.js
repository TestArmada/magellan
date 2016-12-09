"use strict";

var treeUtil = require("testarmada-tree-kill");
var pid = process.pid;
var settings = require("../settings");

// Max time before we forcefully kill child processes left over after a suite run
var ZOMBIE_POLLING_MAX_TIME = 15000;

module.exports = function (callback, opts) {
  var _settings = settings;
  /* istanbul ignore next */
  if (opts && opts.settings) {
    _settings = opts.settings;
  }
  var _console = console;
  /* istanbul ignore next */
  if (opts && opts.console) {
    _console = opts.console;
  }
  var _treeUtil = treeUtil;
  /* istanbul ignore next */
  if (opts && opts.treeUtil) {
    _treeUtil = opts.treeUtil;
  }

  if (_settings.debug) {
    _console.log("Checking for zombie processes...");
  }

  _treeUtil.getZombieChildren(pid, ZOMBIE_POLLING_MAX_TIME, function (zombieChildren) {
    if (zombieChildren.length > 0) {
      _console.log("Giving up waiting for zombie child processes to die. Cleaning up..");

      var killNextZombie = function () {
        if (zombieChildren.length > 0) {
          var nextZombieTreePid = zombieChildren.shift();
          _console.log("Killing pid and its child pids: " + nextZombieTreePid);
          _treeUtil.kill(nextZombieTreePid, "SIGKILL", killNextZombie);
        } else {
          _console.log("Done killing zombies.");
          return callback();
        }
      };

      return killNextZombie();
    } else {
      if (_settings.debug) {
        _console.log("No zombies found.");
      }
      return callback();
    }
  });
};
