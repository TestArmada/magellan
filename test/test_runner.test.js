"use strict";
'use strict';

const TestRunner = require('../src/test_runner');

describe('test_runner', () => {
  describe('constructor', () => {
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
        bailStrategy:
        {
          hasBailed: false,
          name: 'testarmada-magellan-fast-bail-strategy',
          description: 'Magellan will bail as long as one test fails',
          bailReason: 'At least one test has failed',
          decide: () => false
        },
        serial: true,
        allocator: {
        },
        onFinish: () => Promise.resolve()
      }
    })
    test('happy path', () => {
      const t = new TestRunner(tests, options, {
        settings: {
          gatherTrends: true
        }
      });
    });

  });
});