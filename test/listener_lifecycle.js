var chai = require("chai");
var expect = chai.expect;

var TestRunner = require("../src/test_runner");
var _ = require("lodash");
var settings = require("../src/settings");
var WorkerAllocator = require("../src/worker_allocator");
var TestListener = require("../test_support/test_listener");

settings.framework = "magellan-fake";
settings.testFramework = require("../test_support/magellan-selftest-plugin/index");
settings.testFramework.initialize({});

var MAX_WORKERS = 1;

var baseOptions = {
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

describe("test runner", function () {

  describe("listener lifecycle", function () {
    this.timeout(6000);

    var workerAllocator;
    var listener;
    var options;

    beforeEach(function (done) {
      workerAllocator = new WorkerAllocator(MAX_WORKERS);
      listener = new TestListener();
      options = _.extend({}, baseOptions, {
        allocator: workerAllocator,
        listeners: [listener]
      });

      listener.initialize().then(function () {
        done();
      });
    });

    it("initializes", function (done) {
      this.timeout(6000);

      workerAllocator.initialize(function (err) {
        var runner = new TestRunner(["fake_test1"], _.extend({}, options, {
          onSuccess: function () {
            expect(listener.didInitialize).to.equal(true);
            done();
          }
        }));
        runner.start();
      });
    });

    it("flushes", function (done) {
      this.timeout(6000);

      workerAllocator.initialize(function (err) {
        var runner = new TestRunner(["fake_test1"], _.extend({}, options, {
          onSuccess: function () {
            expect(listener.didFlush).to.equal(true);
            done();
          }
        }));
        runner.start();
      });
    });

  });

});