'use strict';

const TestQueue = require('../src/test_queue');
const Test = require('../src/test');

test('should construct', () => {
  const tq = new TestQueue({
    tests: ['a', 'b'],
    workerAmount: 1,
    completeQueueHandler: () => { },
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  expect(tq).toBeInstanceOf(TestQueue);
  expect(tq.workerAmount).toEqual(1);
});

test('should be idle with no test and zero test amount ', () => {
  const tq = new TestQueue({
    tests: [],
    workerAmount: 1,
    completeQueueHandler: () => { },
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  expect(tq.isIdle()).toEqual(true);
  expect(tq.getTestAmount()).toEqual(0);
});

test('shouldn\'t be idle with tests', () => {
  const tq = new TestQueue({
    tests: ['a', 'b'],
    workerAmount: 1,
    completeQueueHandler: () => { },
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  expect(tq.isIdle()).toEqual(false);
  expect(tq.getTestAmount()).toEqual(2);
});

test('should return correct failed and passed tests', () => {
  const tq = new TestQueue({
    tests: [
      { name: 'a', status: Test.TEST_STATUS_FAILED },
      { name: 'b', status: Test.TEST_STATUS_SUCCESSFUL }
    ],
    workerAmount: 1,
    completeQueueHandler: () => { },
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  expect(tq.getFailedTests()).toHaveLength(1);
  expect(tq.getPassedTests()).toHaveLength(1);
});

test('should enqueue a test', () => {
  const tq = new TestQueue({
    tests: [
      { name: 'a', status: Test.TEST_STATUS_FAILED },
      { name: 'b', status: Test.TEST_STATUS_SUCCESSFUL }
    ],
    workerAmount: 1,
    completeQueueHandler: () => { },
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  tq.enqueue({ name: 'c', status: Test.TEST_STATUS_NEW }, 1);
});

test('should terminate a queue early', () => {
  const tq = new TestQueue({
    tests: [
      { name: 'a', status: Test.TEST_STATUS_FAILED },
      { name: 'b', status: Test.TEST_STATUS_SUCCESSFUL }
    ],
    workerAmount: 1,
    completeQueueHandler: () => Promise.resolve('aha'),
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  expect(tq.earlyTerminate()).resolves.toEqual('aha');
});

test('should proceed if no test in queue', () => {
  const tq = new TestQueue({
    tests: [
      { name: 'a', status: Test.TEST_STATUS_FAILED },
      { name: 'b', status: Test.TEST_STATUS_SUCCESSFUL }
    ],
    workerAmount: 1,
    completeQueueHandler: () => { },
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  tq.proceed();

  expect(tq.isIdle()).toEqual(false);
});

test('should proceed if no test in queue', () => {
  const tq = new TestQueue({
    tests: [],
    workerAmount: 1,
    completeQueueHandler: () => Promise.resolve('aha'),
    completeTestHandler: () => { },
    stageTestHandler: () => { }
  });

  expect(tq.proceed()).resolves.toEqual('aha');
});