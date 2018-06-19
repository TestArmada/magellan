"use strict";
'use strict';

const analytics = require("../src/global_analytics");
const TestRunner = require('../src/test_runner');

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

    test('should have error in cb test setup errors out', (done)=>{
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
});