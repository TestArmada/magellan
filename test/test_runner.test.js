"use strict";

const _ = require("lodash")

const analytics = require("../src/global_analytics");
const TestRunner = require('../src/test_runner');
const Test = require("../src/test");
const TestQueue = require("../src/test_queue");

jest.mock('../src/global_analytics', () => {
  return {
    push: () => { },
    mark: () => { }
  };
});


describe('test_runner', () => {
  let tests = [];
  let options = {};

  beforeEach(() => {
    tests = [{ filename: 'tests/demo-web.js' }];

    options = {
      debug: false,
      maxWorkers: 1,
      maxTestAttempts: 3,
      profiles:
        [{
          desiredCapabilities: {},
          nightwatchEnv: 'invisible_chrome',
          id: 'invisible_chrome',
          executor: 'local'
        }],
      executors:
      {
        local:
        {
          name: 'testarmada-magellan-local-executor',
          shortName: 'local'
        }
      },
      listeners: [],
      strategies: {
        bail:
        {
          hasBailed: false,
          name: 'testarmada-magellan-fast-bail-strategy',
          description: 'Magellan will bail as long as one test fails',
          bailReason: 'At least one test has failed',
          shouldBail: () => { },
          decide: () => false
        },
        resource: {
          holdTestResource: (opts) => Promise.resolve()
        }
      },
      serial: true,
      allocator: {
        get: (cb) => cb(null, { index: 1 }),
        release: (worker) => true
      },
      onFinish: () => Promise.resolve()
    }
  })
  test('constructor', () => {

    const t = new TestRunner(tests, options, {
      settings: {
        gatherTrends: true
      }
    });
  });

  describe('stageTestHandler', () => {
    test('should stage test properly', (done) => {
      const t = new TestRunner(tests, options, {
        settings: {
          gatherTrends: true
        }
      });

      let test = {
        executor: {
          setupTest: (cb) => cb(null, "FAKE_TOKEN"),
          teardownTest: (token, cb) => cb()
        },
        pass: () => true,
        fail: () => false
      };

      t.runTest = (test, worker) => Promise.resolve({ error: false });

      t.stageTestHandler(test, (err, test) => {
        expect(err).toBeNull();
        expect(test.error).toBe(false);
        done();
      });
    });

    test('should have error in cb test setup errors out', (done) => {
      const t = new TestRunner(tests, options, {
        settings: {
          gatherTrends: true
        }
      });

      let test = {
        executor: {
          setupTest: (cb) => cb("FAKE_ERROR", "FAKE_TOKEN"),
          teardownTest: (token, cb) => cb()
        },
        pass: () => true,
        fail: () => false
      };

      t.runTest = (test, worker) => Promise.resolve({ error: false });

      t.stageTestHandler(test, (err, test) => {
        expect(err).toBe("FAKE_ERROR");
        done();
      });
    });
  });

  describe('completeTestHandler', () => {
    test('failed test', (done) => {
      options.strategies.bail.hasBailed = false;
      options.strategies.bail.shouldBail = function () { this.hasBailed = true; };

      const t = new TestRunner(tests, options, {
        settings: {
          gatherTrends: true
        }
      });
      t.queue = new TestQueue({
        tests: [],
        workerAmount: 1,
        completeQueueHandler: () => Promise.resolve(1),
        stageTestHandler: (test, cb) => cb()
      });

      t.completeTestHandler(null, {
        status: Test.TEST_STATUS_FAILED,
        canRun: () => true,
        maxAttempts: 3,
        attempts: 2,
        workerIndex: 1,
        getRuntime: () => 3
      })
        .then((v) => {
          expect(v).toBe(1);
          done();
        });
    });
  });
});