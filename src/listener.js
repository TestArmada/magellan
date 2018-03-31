"use strict";

class BaseListener {
  initialize() {
    return Promise.resolve();
  }

  listenTo(/* testRun, test, source */) {
  }

  flush() {
    return Promise.resolve();
  }
}

module.exports = BaseListener;
