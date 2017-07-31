"use strict";

const chai = require("chai");
const chaiAsPromise = require("chai-as-promised");
const _ = require("lodash");

const TestRunner = require("../src/test_runner");
const logger = require("../src/logger");

const BailStrategy = require("../src/bail");

const BAIL_FAST = process.cwd() + "/src/strategies/bail_fast";
const BAIL_NEVER = process.cwd() + "/src/strategies/bail_never";
const BAIL_EARLY = process.cwd() + "/src/strategies/bail_early";

chai.use(chaiAsPromise);

const expect = chai.expect;
const assert = chai.assert;

const settings = {
  buildId: "FADSFASDF_ASDFSADF2",
  gatherTrends: true,
  testFramework: {
    TestRun: function () {
      return {
        getEnvironment() { },
        enableExecutor() { }
      }
    }
  }
};

const tests = [
  { filename: 'tests/demo-app.js' },
  { filename: 'tests/demo-web.js' }
];

const executors = {
  "sauce": {
    name: "testarmada-magellan-sauce-executor",
    shortName: "sauce",

    getPorts(opts) {
      return {
        seleniumPort: opts.portOffset,
        mockingPort: opts.portOffset + 1
      }
    },
    getProfiles(opts) {
      return new Promise((resolve) => {
        resolve(opts.profiles);
      });
    },
    getCapabilities(profile, opts) {
      return new Promise((resolve) => {
        resolve(profile);
      });
    },
    setupTest(callback) {
      callback(null, "FAKE_EXECUTOR_TOKEN");
    },
    teardownTest(token, callback) {
      callback();
    },
    execute() {
      return {
        on(code, callback) {
          if (code === "message") {
            callback({ type: "test-meta-data", metadata: { resultURL: "FAKE_URL", sessionId: "FAKE_SESSION" } })
          }
          else {
            callback(0);
          }
        },
        send() { },
        removeAllListeners() { },
        stdout: {
          on(type, callback) { callback() },
          removeAllListeners() { },
          unpipe() { }
        },
        stderr: {
          on(type, callback) { callback() },
          removeAllListeners() { },
          unpipe() { }
        }
      }
    },
    summerizeTest(buildid, metadat, callback) { callback(); },
    wrapup(callback) { callback(); }
  }
};

const profiles = [
  { browser: "chrome", executor: "sauce" },
  { browser: "firefox", executor: "sauce" }
];

const allocator = {
  get(callback) { callback(null, { token: "FAKE_WORKER_TOKEN" }); },
  release() { }
};

const options = {
  debug: true,
  maxWorkers: 1,
  maxTestAttempts: 1,
  serial: true,
  onFailure() { },
  onSuccess() { },
  allocator: {},
  listeners: [{
    flush() { return new Promise((resolve) => { resolve() }); },
    listenTo() { }
  }]
};

let optsMock = {
  fs: {
    readFileSync() {
      return "{\"failures\":{\"a\":1}}";
    },
    writeFileSync() { }
  },
  setTimeout(callback) { callback(); },
  path: {
    resolve() { return "FAKE_TEMP_PATH"; }
  },
  mkdirSync() { },
  setInterval(callback) { callback(); }
};

let optionsMock = {};

describe("test_runner", () => {
  beforeEach(() => {
    optsMock.settings = _.cloneDeep(settings);
    optionsMock = _.cloneDeep(options);
    optionsMock.profiles = _.cloneDeep(profiles);
    optionsMock.executors = _.cloneDeep(executors);
    optionsMock.allocator = _.cloneDeep(allocator);
    optionsMock.bailStrategy = new BailStrategy(BAIL_NEVER);
  });

  describe("initialize", () => {
    it("should pass", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      expect(tr.numTests).to.equal(4);
      expect(tr.profiles.length).to.equal(2);
    });

    it("[backward compatibility] should pass with bail fast", () => {
      optionsMock.bailStrategy = new BailStrategy(BAIL_FAST);
      const tr = new TestRunner(tests, optionsMock, optsMock);
      expect(tr.bailStrategy.name).to.equal(optionsMock.bailStrategy.name);
    });

    it("[backward compatibility] should pass with bail early", () => {
      optionsMock.bailStrategy = new BailStrategy(BAIL_EARLY);
      const tr = new TestRunner(tests, optionsMock, optsMock);
      expect(tr.bailStrategy.name).to.equal(optionsMock.bailStrategy.name);
    });

    it("[backward compatibility] should pass with bail never", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      expect(tr.bailStrategy.name).to.equal(optionsMock.bailStrategy.name);
    });
  });

  it("notIdle", () => {
    const tr = new TestRunner(tests, optionsMock, optsMock);
    tr.notIdle();
    expect(tr.busyCount).to.equal(1);
  });

  it("maybeIdle", () => {
    const tr = new TestRunner(tests, optionsMock, optsMock);
    tr.busyCount = 1;
    tr.maybeIdle();
    expect(tr.busyCount).to.equal(0);
  });

  it("logFailedTest", () => {
    const tr = new TestRunner(tests, optionsMock, optsMock);
    tr.failedTests = [{
      toString() { },
      attempts: 3,
      stdout: "",
      stderr: ""
    }];

    tr.logFailedTests();
  });

  it("gatherTrends", () => {
    const tr = new TestRunner(tests, optionsMock, optsMock);
    tr.trends.failures = {
      a: 1
    };
    tr.gatherTrends();
  });

  describe("summarizeCompletedBuild", () => {
    it("no failed test", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.startTime = (new Date()).getTime() - 300000;
      return tr.summarizeCompletedBuild();
    });

    it("two failed tests, bail", () => {
      optionsMock.bailStrategy = new BailStrategy(BAIL_FAST);
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.bailStrategy.hasBailed = true;
      tr.tests[0].status = 3;
      tr.tests[0].getRetries = () => 3;
      tr.failedTests = [{ attempts: 3 }];
      tr.startTime = (new Date()).getTime() - 300000;
      return tr.summarizeCompletedBuild();
    });

    it("two failed tests, bail with existing retries", () => {
      optionsMock.bailStrategy = new BailStrategy(BAIL_FAST);
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.bailStrategy.hasBailed = true;
      tr.tests[0].status = 3;
      tr.tests[0].getRetries = () => 3;
      tr.tests[1].status = 3;
      tr.tests[1].getRetries = () => 3;
      tr.failedTests = [{ attempts: 3 }];
      tr.startTime = (new Date()).getTime() - 300000;
      return tr.summarizeCompletedBuild();
    });

    it("two failed tests, no bail", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.failedTests = [{ attempts: 3 }, { attempts: 3 }];
      tr.startTime = (new Date()).getTime() - 300000;
      return tr.summarizeCompletedBuild();
    });

    it("listener doesn't flush function", () => {
      optionsMock.listeners = [{ flush: "asdf" }];
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.startTime = (new Date()).getTime() - 300000;
      return tr.summarizeCompletedBuild();
    });

    it("listener doesn't flush promise", () => {
      optionsMock.listeners = [{ flush() { } }];
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.startTime = (new Date()).getTime() - 300000;
      return tr.summarizeCompletedBuild();
    });

    it("listener doesn't flush promise resolve", () => {
      optionsMock.listeners = [{ flush() { return new Promise((resolve, reject) => { reject(); }) } }];
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.startTime = (new Date()).getTime() - 300000;
      return tr.summarizeCompletedBuild();
    });
  });

  describe("buildFinished", () => {
    it("should succeed", (done) => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.onFailure = () => assert(false, "shouldn't be here");
      tr.onSuccess = () => done();
      tr.startTime = (new Date()).getTime() - 300000;
      tr.buildFinished();
    });

    it("should fail", (done) => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.onFailure = () => done();
      tr.onSuccess = () => assert(false, "shouldn't be here");
      tr.failedTests = [{}];
      tr.startTime = (new Date()).getTime() - 300000;
      tr.buildFinished();
    });
  });

  it("checkBuild", () => {
    optionsMock.bailStrategy = new BailStrategy(BAIL_EARLY);
    const tr = new TestRunner(tests, optionsMock, optsMock);
    tr.bailStrategy.setConfiguration({ "early_bail_min_attempts": 1 });
    tr.startTime = (new Date()).getTime() - 300000;
    tr.checkBuild();
  });

  describe("onTestComplete", () => {
    const failedTest = {
      locator: { filename: 'tests/demo-app.js' },
      maxAttempts: 3,
      attempts: 0,
      status: 2,
      profile: { browser: 'chrome' },
      executor: undefined,
      workerIndex: -1,
      error: undefined,
      stdout: '',
      stderr: '',
      getRetries() { },
      canRun() { return false },
      getRuntime() { }
    };

    const successfulTest = {
      locator: { filename: 'tests/demo-app.js' },
      maxAttempts: 1,
      attempts: 0,
      status: 3,
      profile: { browser: 'chrome' },
      executor: executors["sauce"],
      workerIndex: -1,
      error: undefined,
      stdout: '',
      stderr: '',
      getRetries() { }
    };

    it("has bailed", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.bailStrategy.hasBailed = true;
      tr.onTestComplete(null, failedTest);
    });

    it("successful test", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.onTestComplete(null, successfulTest);
    });

    it("successful test without serial", () => {
      optionsMock.serial = false;
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.onTestComplete(null, successfulTest);
    });

    it("failed test", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.onTestComplete(null, failedTest);
    });
  });

  describe("start", () => {
    it("no test", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.tests = [];
      tr.start();
    });

    it("multi tests without serial", () => {
      optionsMock.serial = false;
      optionsMock.executors["sauce"].summerizeTest = (buildid, metadat, callback) => callback("wt");
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.start();
    });
  });

  describe("runTest", () => {
    const worker = { portOffset: 1 };

    it("no bail", () => {
      const tr = new TestRunner(tests, optionsMock, optsMock);
      return tr.runTest(tr.tests[0], worker).then();
    });

    it("throws error", () => {
      optsMock.settings.testFramework.TestRun = function () {
        throw new Error("FAKE_ERROR");
      };

      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.bailStrategy.hasBailed = false;
      return tr.runTest(tr.tests[0], worker)
        .then()
        .catch(err => expect(err.message).to.equal("FAKE_ERROR"));
    });
  });

  describe("execute", () => {
    const successfulTest = {
      locator: { filename: 'tests/demo-app.js' },
      maxAttempts: 1,
      attempts: 0,
      status: 3,
      profile: { browser: 'chrome', executor: "sauce" },
      executor: executors["sauce"],
      workerIndex: -1,
      error: undefined,
      stdout: '',
      stderr: '',
      getRetries() { },
      startClock() { },
      getRuntime() { },
      stopClock() { }
    };

    it("getEnvironment failed", () => {
      const testRun = {
        getEnvironment() { throw new Error("FAKE_ERROR") },
        enableExecutor() { }
      };

      const tr = new TestRunner(tests, optionsMock, optsMock);
      return tr.execute(testRun, successfulTest)
        .then()
        .catch(err => {
          expect(err.message).to.equal("FAKE_ERROR");
        })
    });

    it("bail fast", () => {
      const testRun = {
        getEnvironment() { },
        enableExecutor() { }
      };


      optionsMock.executors["sauce"].execute = () => {
        return {
          on(code, callback) {
            if (code === "message") {
              callback({ type: "test-meta-data", metadata: { resultURL: "FAKE_URL", sessionId: "FAKE_SESSION" } });
            }
            else {
              callback(1);
            }
          },
          send() { },
          removeAllListeners() { },
          stdout: {
            on() { },
            removeAllListeners() { },
            unpipe() { }
          },
          stderr: {
            on() { },
            removeAllListeners() { },
            unpipe() { }
          }
        }
      }

      optionsMock.bailStrategy = new BailStrategy(BAIL_FAST);
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.bailStrategy.hasBailed = true;
      return tr.execute(testRun, successfulTest)
        .then(result => expect(result.error).to.equal("Child test run process exited with code 1"));
    });

    it("no bail", () => {
      const testRun = {
        getEnvironment() { },
        enableExecutor() { }
      };

      optionsMock.executors["sauce"].execute = () => {
        return {
          on(code, callback) {
            if (code === "message") {
              callback({ type: "test-meta-data", metadata: { resultURL: "FAKE_URL", sessionId: "FAKE_SESSION" } })
            }
            else {
              callback(1);
            }
          },
          send() { },
          removeAllListeners() { },
          stdout: {
            on() { },
            removeAllListeners() { },
            unpipe() { }
          },
          stderr: {
            on() { },
            removeAllListeners() { },
            unpipe() { }
          }
        }
      };

      optionsMock.bailStrategy = new BailStrategy(BAIL_NEVER);
      const tr = new TestRunner(tests, optionsMock, optsMock);
      
      return tr.execute(testRun, successfulTest)
        .then(result => expect(result.error).to.equal("Child test run process exited with code 1"));
    });
  });

  describe("stageTest", () => {
    it("executor stage error", (done) => {
      const onTestComplete = () => done();
      optionsMock.executors["sauce"].setupTest = (callback) => callback("error");
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.stageTest(tr.tests[0], onTestComplete);
    });

    it("allocator get error", (done) => {
      const onTestComplete = () => done();
      optionsMock.allocator.get = (callback) => callback("error");

      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.stageTest(tr.tests[0], onTestComplete);
    });

    it("runTestError", () => {
      optsMock.settings.testFramework.TestRun = function () {
        throw new Error("FAKE_ERROR");
      };

      const onTestComplete = () => done();
      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.stageTest(tr.tests[0], onTestComplete);
    });

    it("successful", (done) => {
      const onTestComplete = () => done();

      const tr = new TestRunner(tests, optionsMock, optsMock);
      tr.stageTest(tr.tests[0], onTestComplete);
    });
  });
});