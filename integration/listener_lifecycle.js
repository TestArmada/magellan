const chai = require("chai");
const expect = chai.expect;

const TestRunner = require("../src/test_runner");
const _ = require("lodash");
const settings = require("../src/settings");
const WorkerAllocator = require("../src/worker_allocator");
const TestListener = require("../test_support/test_listener");

settings.framework = "magellan-fake";
settings.testFramework = require("../test_support/magellan-selftest-plugin/index");
settings.testFramework.initialize({});

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

  describe("listener lifecycle", function () {
    this.timeout(6000);

    let workerAllocator;
    let listener;
    let options;

    beforeEach((done) => {
      workerAllocator = new WorkerAllocator(MAX_WORKERS);
      listener = new TestListener();
      options = _.extend({}, baseOptions, {
        allocator: workerAllocator,
        listeners: [listener]
      });

      listener.initialize().then(() => {
        done();
      });
    });

    it("initializes", function (done) {
      this.timeout(6000);

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(["fake_test1"], _.extend({}, options, {
          onSuccess () {
            expect(listener.didInitialize).to.equal(true);
            done();
          }
        }));
        runner.start();
      });
    });

    it("flushes", function (done) {
      this.timeout(6000);

      workerAllocator.initialize((err) => {
        const runner = new TestRunner(["fake_test1"], _.extend({}, options, {
          onSuccess () {
            expect(listener.didFlush).to.equal(true);
            done();
          }
        }));
        runner.start();
      });
    });

  });

});
