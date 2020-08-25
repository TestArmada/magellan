var chai = require("chai");
var expect = chai.expect;

var TestRunner = require("../src/test_runner");
var _ = require("lodash");
var settings = require("../src/settings");
var WorkerAllocator = require("../src/worker_allocator");
var TestAnalyticsListener = require("../test_support/test_analytics_listener");

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

describe("analytics", function () {

  describe("events", function () {
    this.timeout(6000);

    var workerAllocator;
    var listener;
    var options;

    beforeEach(function (done) {
      workerAllocator = new WorkerAllocator(MAX_WORKERS);
      listener = new TestAnalyticsListener();
      options = _.extend({}, baseOptions, {
        allocator: workerAllocator,
        listeners: [listener]
      });

      listener.initialize().then(function () {
        done();
      });
    });

    it("emits events @analytics", function (done) {
      this.timeout(6000);

      workerAllocator.initialize(function (err) {
        var runner = new TestRunner(["fake_test1"], _.extend({}, options, {
          onSuccess: function () {
            // we should see at least fake test start and finish
            var testRunEvents = listener.timeline.filter(function (ev) {
              return (ev.data && ev.data.name && _.startsWith(ev.data.name, "test-run-"))
                || (ev.eventName && _.startsWith(ev.eventName, "test-run-"));
            });
            expect(testRunEvents).to.have.length.of(2);
            done();
          }
        }));
        runner.start();
      });
    });

  });

});