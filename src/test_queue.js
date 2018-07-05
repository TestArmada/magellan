"use strict";

const async = require("async");
const _ = require("lodash");

const constants = require("./constants");
const Test = require("./test");

// TODO: document this file
// Test to be retried has higher priority than new tests

class TestQueue {
  constructor(options) {
    this.tests = options.tests;
    this.workerAmount = options.workerAmount;

    this.handlers = {
      completeQueueHandler: options.completeQueueHandler,
      completeTestHandler: options.completeTestHandler
    };

    this.priorityQueue = async.priorityQueue(
      options.stageTestHandler,
      this.workerAmount
    );

    this.priorityQueue.drain = options.completeQueueHandler;
    // queue is paused till resume is called
    this.priorityQueue.pause();

    // we put everything in priorityQueue from beginning
    _.forEach(this.tests, (test) => {
      this.priorityQueue.push(
        test,
        constants.TEST_PRIORITY.FIRST_RUN,
        options.completeTestHandler);
    });
  }

  isIdle() {
    return this.priorityQueue.idle();
  }

  getTestAmount() {
    return this.tests.length;
  }

  getFailedTests() {
    return _.filter(this.tests,
      (test) => test.status === Test.TEST_STATUS_FAILED);
  }

  getPassedTests() {
    return _.filter(this.tests,
      (test) => test.status === Test.TEST_STATUS_SUCCESSFUL);
  }

  proceed() {
    if (_.isEmpty(this.tests)) {
      return this.priorityQueue.drain();
    } else {
      return this.priorityQueue.resume();
    }
  }

  enqueue(test, priority) {
    return this.priorityQueue.push(test, priority, this.handlers.completeTestHandler);
  }

  earlyTerminate() {
    this.priorityQueue.kill();
    return this.handlers.completeQueueHandler();
  }
}

module.exports = TestQueue;
