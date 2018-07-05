"use strict";

const _ = require("lodash")

const analytics = require("../src/global_analytics");
const fs = require("fs");
const logger = require("../src/logger");
const mkdirSync = require("../src/util/mkdir_sync");
const path = require("path");
const settings = require("../src/settings");
const ChildProcessHandler = require("../src/util/childProcess");
const Reporter = require("../src/reporters/stdout/reporter");
const TestRunner = require("../src/test_runner");
const Test = require("../src/test");
const TestQueue = require("../src/test_queue");


jest.mock("../src/global_analytics", () => {
  return {
    push: () => { },
    mark: () => { }
  };
});

jest.mock("fs");

jest.mock("../src/util/childProcess");

jest.mock("../src/reporters/stdout/reporter");

describe("test_runner", () => {
  let tests = [];
  let options = {};

  beforeEach(() => {
    tests = [{ filename: "tests/demo-web.js" }];

    options = {
      debug: false,
      maxWorkers: 1,
      maxTestAttempts: 3,
      profiles:
        [{
          desiredCapabilities: {},
          nightwatchEnv: "invisible_chrome",
          id: "invisible_chrome",
          executor: "local"
        }],
      executors:
      {
        local:
        {
          name: "testarmada-magellan-local-executor",
          shortName: "local",
          execute: () => {}
        }
      },
      listeners: [],
      strategies: {
        bail:
        {
          hasBailed: false,
          name: "testarmada-magellan-fast-bail-strategy",
          description: "Magellan will bail as long as one test fails",
          bailReason: "At least one test has failed",
          shouldBail: () => { },
          decide: () => false
        },
        resource: {
          holdTestResource: (opts) => Promise.resolve(),
          releaseTestResource: (opts) => Promise.resolve()
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
  
  test("constructor", () => {
    const testRunner = initTestRunner(tests, options);
  });

  describe("stageTestHandler", () => {
    test("should stage test properly", (done) => {
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();

      testRunner.runTest = (test, worker) => Promise.resolve({ erroror: false });

      testRunner.stageTestHandler(test, (error, test) => {
        expect(error).toBeNull();
        expect(test.erroror).toBe(false);
        done();
      });
    });

    test("should have erroror in cb test setup errors out", (done) => {
      const testRunner = initTestRunner(tests, options);
      const test = stubFailTest();

      testRunner.runTest = (test, worker) => Promise.resolve({ erroror: false });

      testRunner.stageTestHandler(test, (error, test) => {
        expect(error).toBe("FAKE_ERROR");
        done();
      });
    });
    
    test("test run exception results in test failure", (done) => {
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();

      testRunner.runTest = (test, worker) => Promise.reject({ erroror: true });
      testRunner.stageTestHandler(test, (error, test) => {
        expect(error).toBeDefined();
        expect(test.fail).toHaveBeenCalled();
        done();
      });
    });
    
    test("test run error results in test failure", (done) => {
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();

      testRunner.runTest = (test, worker) => Promise.resolve({ error: true });
      testRunner.stageTestHandler(test, (error, test) => {
        expect(error).toBeDefined();
        expect(test.fail).toHaveBeenCalled();
        done();
      });
    });
    
    test("catch runtime resource error", (done) => {
      options.strategies.resource.holdTestResource = () => Promise.reject("FAILURE");
      
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();

      testRunner.stageTestHandler(test, (error, test) => {
        expect(error).toBeDefined();
        done();
      });
    });
    
    test("worker error results in test failure", (done) => {
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      
      testRunner.allocator.get = (cb) => cb(true, { index: 1});

      testRunner.stageTestHandler(test, (error, test) => {
        expect(error).toBeDefined();
        done();
      });
    });
  });

  describe("completeTestHandler", () => {
    test("successful test", (done) => {
      const testRunner = initTestRunner(tests, options);
      const error = jest.fn();
      
      testRunner.completeTestHandler(error, {
        status: Test.TEST_STATUS_SUCCESSFUL,
        canRun: () => true,
        maxAttempts: 3,
        attempts: 2,
        workerIndex: 1,
        getRuntime: () => 3
      });

      expect(error).not.toHaveBeenCalled();
      done();
    });
    
    test("failed test", (done) => {
      options.strategies.bail.hasBailed = false;
      options.strategies.bail.shouldBail = function () { this.hasBailed = true; };
      const testRunner = initTestRunner(tests, options);

      testRunner.completeTestHandler(null, {
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
    
    test("bailed test", (done) => {
      options.strategies.bail.hasBailed = true;

      const testRunner = initTestRunner(tests, options);
      const test = {
        status: Test.TEST_STATUS_SUCCESSFUL,
        canRun: () => true,
        maxAttempts: 3,
        attempts: 2,
        workerIndex: 1,
        getRuntime: () => 3
      };
      
      testRunner.completeTestHandler(null, test);
      
      expect(test.status).toBe(Test.TEST_STATUS_SKIPPED)
      done();
    });
    
    test("new test", (done) => {
      const testRunner = initTestRunner(tests, options);
      const error = jest.fn();
      
      testRunner.completeTestHandler(error, {
        status: Test.TEST_STATUS_NEW,
        canRun: () => true,
        maxAttempts: 3,
        attempts: 2,
        workerIndex: 1,
        getRuntime: () => 3
      });

      expect(error).not.toHaveBeenCalled();
      done();
    });
    
    test("test that fail are enqueued again", (done) => {
      const testRunner = initTestRunner(tests, options);
      const error = jest.fn();
      const queueEnqueueSpy = jest.spyOn(testRunner.queue, "enqueue");
      
      testRunner.completeTestHandler(error, {
        status: Test.TEST_STATUS_FAILED,
        canRun: () => false,
        maxAttempts: 3,
        attempts: 2,
        workerIndex: 1,
        getRuntime: () => 3
      });

      expect(queueEnqueueSpy).toHaveBeenCalled();
      done();
    });
  });
  
  describe("completeQueueHandler", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    test("listeners are successfully resolved", (done) => {
      const listener = new Reporter();
      listener.flush = () => Promise.resolve(10);
      const listenerFlushSpy = jest.spyOn(listener, "flush");
      
      options.listeners = [ listener ];
      
      const testRunner = initTestRunner(tests, options);
      testRunner.completeQueueHandler();

      jest.runAllTimers();
      
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(listenerFlushSpy).toHaveBeenCalled();
      done();
    });
    
    test("listeners are successfully resolved even when flush has error", (done) => {
      const listener = new Reporter();
      listener.flush = () => Promise.reject();
      const listenerFlushSpy = jest.spyOn(listener, "flush");
      
      options.listeners = [ listener ];
      
      const testRunner = initTestRunner(tests, options);
      testRunner.completeQueueHandler();

      jest.runAllTimers();
      
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(listenerFlushSpy).toHaveBeenCalled();
      done();
    });
  });
  
  describe("run", () => {  
    test("run is executed successfully", (done) => {
      const testRunner = initTestRunner(tests, options);
      testRunner.queue.proceed = jest.fn();
      
      testRunner.run();
      
      expect(testRunner.queue.proceed).toHaveBeenCalled();
      done();
    });
    
    test("run in serial is executed successfully", (done) => {
      const testRunner = initTestRunner(tests, options);
      testRunner.serial = true;
      testRunner.queue.proceed = jest.fn();
      
      testRunner.run();
      
      expect(testRunner.queue.proceed).toHaveBeenCalled();
      done();
    });
  });
  
  describe("runTest", () => {    
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    test("test is run successfully", (done) => {
      fs.mkdirSync.mockImplementation((p) => { });
      
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      
      let worker = { 
        index: 1, 
        occupied: true, 
        portOffset: 12000
      };
      
      testRunner.execute = (testRun, test) => Promise.resolve({ error: false });
      const executeSpy = jest.spyOn(testRunner, "execute");

      testRunner.runTest(test, worker).then((v) => {
        expect(executeSpy).toHaveBeenCalledTimes(1);
        done();
      });
      
      jest.runAllTimers();
    });
    
    test("test in serial is run successfully", (done) => {
      fs.mkdirSync.mockImplementation((p) => { });
      
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      
      let worker = { 
        index: 1, 
        occupied: true, 
        portOffset: 12000,
        token: "SOME_TOKEN"
      };
      
      testRunner.execute = (testRun, test) => Promise.resolve({ error: false });
      const executeSpy = jest.spyOn(testRunner, "execute");

      testRunner.serial = true;
      testRunner.runTest(test, worker).then((v) => {
        expect(executeSpy).toHaveBeenCalledTimes(1);
        done();
      });
      
      jest.runAllTimers();
    });
    
    test("failed test is rejected", (done) => {
      fs.mkdirSync.mockImplementation((p) => { });
      
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      
      let worker = { 
        index: 1, 
        occupied: true, 
        portOffset: 12000,
        token: "SOME_TOKEN"
      };
      
      testRunner.execute = (testRun, test) => Promise.reject("EXECUTION_ERROR");
      const executeSpy = jest.spyOn(testRunner, "execute");

      testRunner.runTest(test, worker).catch((v) => {
        expect(executeSpy).toHaveBeenCalledTimes(1);
        done();
      });
      
      jest.runAllTimers();
    });
    
    test("empty buildId is rejected", (done) => {
      fs.mkdirSync.mockImplementation((p) => { });

      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      
      let worker = { 
        index: 1, 
        occupied: true, 
        portOffset: 12000,
        token: "SOME_TOKEN"
      };
      
      testRunner.buildId = null;

      testRunner.runTest(test, worker).catch((v) => {
        done();
      });
      
      jest.runAllTimers();
    });
  });
  
  describe("execute", () => {  
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    test("test is executed successfully", (done) => {
      const listener = new Reporter();
      const listenerListenToSpy = jest.spyOn(listener, "listenTo");

      options.listeners = [ listener ];

      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      const testRun = {
        guid: "",
        getEnvironment: (opts) => ""
      };

      testRunner.execute(testRun, test);
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();
      
      expect(listenerListenToSpy).toHaveBeenCalled();
      done();
    });
    
    test("bailing a test closes the execution worker", (done) => {
      const listener = new Reporter();
      const listenerListenToSpy = jest.spyOn(listener, "listenTo");

      options.listeners = [ listener ];
      options.strategies.bail.hasBailed = true;
      options.strategies.bail.getBailReason = jest.fn();
      
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      const testRun = {
        guid: "",
        getEnvironment: (opts) => ""
      };

      testRunner.execute(testRun, test);
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();
      
      expect(listenerListenToSpy).toHaveBeenCalled();
      expect(options.strategies.bail.getBailReason).toHaveBeenCalled();
      done();
    });
    
    test("test environment error results in promise rejection", () => {
      const listener = new Reporter();
      const listenerListenToSpy = jest.spyOn(listener, "listenTo");

      options.listeners = [ listener ];
      
      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      const testRun = {
        guid: "",
        getEnvironment: (opts) => {
          throw "ENVIRONMENT_ERROR";
        }
      };

      return testRunner.execute(testRun, test).catch(e => expect(e).toMatch("ENVIRONMENT_ERROR"));
    });
    
    test("child process error results in promise rejection", () => {
      const listener = new Reporter();
      const listenerListenToSpy = jest.spyOn(listener, "listenTo");

      options.listeners = [ listener ];
      options.executors.local.execute = () => {
        throw "CHILD_PROCESS_ERROR";
      };

      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      const testRun = {
        guid: "",
        getEnvironment: (opts) => ""
      };

      return testRunner.execute(testRun, test).catch(e => expect(e).toMatch("CHILD_PROCESS_ERROR"));
    });
    
    test("listener error results in promise rejection", () => {
      const listener = new Reporter();
      listener.listenTo = () => {
        throw "LISTENER_ERROR";
      };

      options.listeners = [ listener ];

      const testRunner = initTestRunner(tests, options);
      const test = stubPassTest();
      const testRun = {
        guid: "",
        getEnvironment: (opts) => ""
      };

      return testRunner.execute(testRun, test).catch(e => expect(e).toMatch("LISTENER_ERROR"));
    });
  });
  
  describe("logTestsSummary", () => {    
    test("empty test print no warning", (done) => {
      const warnSpy = jest.spyOn(logger, "warn");

      const testRunner = initTestRunner(tests, options);

      testRunner.logTestsSummary();
      
      expect(warnSpy).not.toHaveBeenCalled();
      done();
    });
    
    test("passing 1 test and failing 1 test prints 4 warnings", (done) => {
      const loggerLogSpy = jest.spyOn(logger, "log");
      const loggerWarnSpy = jest.spyOn(logger, "warn");
      const analyticsMarkSpy = jest.spyOn(analytics, "mark");
      
      const testRunner = initTestRunner(tests, options);
      enqueuePassedTest(testRunner);
      enqueueFailedTest(testRunner);

      testRunner.logTestsSummary();
      
      expect(loggerLogSpy).toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalled();
      expect(analyticsMarkSpy).toHaveBeenCalledWith("magellan-run", "failed");
      done();
    });
    
    test("failing 1 test with bail prints 4 warnings with bail reason", (done) => {
      options.strategies.bail.hasBailed = true;
      options.strategies.bail.getBailReason = () => "Some bail reason";
      
      const loggerLogSpy = jest.spyOn(logger, "log");
      const loggerWarnSpy = jest.spyOn(logger, "warn");
      const analyticsMarkSpy = jest.spyOn(analytics, "mark");
      const bailReasonSpy = jest.spyOn(options.strategies.bail, "getBailReason");

      const testRunner = initTestRunner(tests, options);
      enqueueFailedTest(testRunner);

      testRunner.logTestsSummary();
      
      expect(loggerLogSpy).toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalled();
      expect(bailReasonSpy).toHaveBeenCalled();
      expect(analyticsMarkSpy).toHaveBeenCalledWith("magellan-run", "failed");
      done();
    });
  });
});

function initTestRunner(tests, options, numPassedTests, numFailedTests) {
  const testRunner = new TestRunner(tests, options, {
    settings: {
      gatherTrends: true,
      debugVerbose: true,
      buildId: "FAKE_BUILD_ID",
      testFramework: {
        iterator: () => ["a", "b", "c"],
        filters: {
          a: () => true,
          b: () => true
        },
        TestRun: class {}
      },
      BASE_PORT_SPACING: 3
    },
    startTime: (new Date()).getTime()
  });
  
  testRunner.queue = new TestQueue({
    tests: [],
    workerAmount: 1,
    completeQueueHandler: () => Promise.resolve(1),
    stageTestHandler: (test, cb) => cb()
  });

  return testRunner;
}

function enqueuePassedTest(testRunner) {
  testRunner.queue.tests.push({
    status: Test.TEST_STATUS_SUCCESSFUL,
    getRetries: () => true
  });
}

function enqueueFailedTest(testRunner) {
  testRunner.queue.tests.push({
    status: Test.TEST_STATUS_FAILED,
    getRetries: () => true
  });
}

function stubPassTest() {
  return {
    executor: {
      setupTest: (cb) => cb(null, "FAKE_TOKEN"),
      teardownTest: (token, cb) => cb(),
      summerizeTest: () => {},
      getPorts: jest.fn()
    },
    profile: {
      executor: "local"
    },
    locator: "",
    startClock: () => {},
    stopClock: () => {},
    getRuntime: () => 0,
    stdout: () => {},
    pass: jest.fn(),
    fail: jest.fn()
  }
}

function stubFailTest() {
  return {
    executor: {
      setupTest: (cb) => cb("FAKE_ERROR", "FAKE_TOKEN"),
      teardownTest: (token, cb) => cb(),
      summerizeTest: () => {},
      getPorts: jest.fn()
    },
    profile: {
      executor: "local"
    },
    locator: "",
    startClock: () => {},
    stopClock: () => {},
    getRuntime: () => 0,
    stdout: () => {},
    pass: jest.fn(),
    fail: jest.fn()
  }
}