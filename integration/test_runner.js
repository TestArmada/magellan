const assert = require("assert");
const TestRunner = require("../src/test_runner");
const _ = require("lodash");
const settings = require("../src/settings");
const WorkerAllocator = require("../src/worker_allocator");

settings.framework = "magellan-fake";
settings.testFramework = require("../test_support/magellan-selftest-plugin/index");
settings.testFramework.initialize({});

const DEFAULT_BAIL_TIME = settings.bailTime;
const MAX_WORKERS = 1;

const baseOptions = {
  debug: false,
  maxWorkers: MAX_WORKERS,
  maxTestAttempts: 1,
  browsers: ["phantomjs"],
  listeners: [],
  bailFast: false,
  bailOnThreshold: false,
  serial: false,

  allocator: undefined,
  sauceSettings: undefined
};

describe("test runner", () => {

  beforeEach(() => {
    settings.bailTime = DEFAULT_BAIL_TIME;
  });

  describe("single worker", function () {
    this.timeout(6000);

    it("runs zero tests", (done) => {
      const options = _.extend({}, baseOptions, {
        onSuccess: done
      });

      const runner = new TestRunner([], options);
      runner.start();
    });

    it("runs one test @testtag", function (done) {
      this.timeout(6000);

      const workerAllocator = new WorkerAllocator(MAX_WORKERS);

      const options = _.extend({}, baseOptions, {
        allocator: workerAllocator,
        onSuccess: done
      });

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(["fake_test1"], options);
        runner.start();
      });
    });

    it("fails one test @testtag", function (done) {
      this.timeout(6000);

      const workerAllocator = new WorkerAllocator(MAX_WORKERS);

      const options = _.extend({}, baseOptions, {
        allocator: workerAllocator,
        onFailure () {
          done();
        }
      });

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(["fail_test1"], options);
        runner.start();
      });
    });


  });

  describe("multi-worker", function () {
    this.timeout(6000);

    const MAX_WORKERS = 8;
    const multiWorkerBaseOptions = _.extend({}, baseOptions, {
      maxWorkers: MAX_WORKERS
    });

    it("runs zero tests @testtag @multi", (done) => {
      const options = _.extend({}, multiWorkerBaseOptions, {
        onSuccess: done
      });

      const runner = new TestRunner([], options);
      runner.start();
    });

    it("runs one test", function (done) {
      this.timeout(6000);

      const workerAllocator = new WorkerAllocator(MAX_WORKERS);

      const options = _.extend({}, multiWorkerBaseOptions, {
        allocator: workerAllocator,
        onSuccess: done
      });

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(["fake_test1"], options);
        runner.start();
      });
    });

    it("runs many tests", function (done) {
      this.timeout(25000);

      const workerAllocator = new WorkerAllocator(MAX_WORKERS);

      const options = _.extend({}, multiWorkerBaseOptions, {
        allocator: workerAllocator,
        onSuccess: done
      });

      const tests = [];
      for (let i = 0; i < 14; i++) {
        tests.push("fake_test" + i);
      }

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(tests, options);
        runner.start();
      });
    });

    it.only("detects a zombie process @zombie", function (done) {
      this.timeout(25000);
      settings.bailTime = 2500;

      const workerAllocator = new WorkerAllocator(MAX_WORKERS);

      const options = _.extend({}, multiWorkerBaseOptions, {
        bailFast: true,
        allocator: workerAllocator,
        onSuccess () {
          done();
        },
        onFailure () {
          done();
        }
      });

      const tests = ["zombie"];

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(tests, options);
        runner.start();
      });
    });

    it("runs many tests and fails two", function (done) {
      this.timeout(25000);

      const workerAllocator = new WorkerAllocator(MAX_WORKERS);

      const options = _.extend({}, multiWorkerBaseOptions, {
        allocator: workerAllocator,
        onFailure () {
          done();
        }
      });

      const tests = [];
      for (let i = 0; i < 14; i++) {
        if (i == 7 || i == 11) {
          tests.push("fail_test" + i);
        } else {
          tests.push("fake_test" + i);
        }
      }

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(tests, options);
        runner.start();
      });
    });


  });
});
